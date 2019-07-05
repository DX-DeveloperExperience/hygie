import { Runnable } from './runnable.class';
import { RuleResult } from '../rules/ruleResult';
import { render } from 'mustache';
import { CallbackType } from './runnables.service';
import { RunnableDecorator } from './runnable.decorator';
import { GitApiInfos } from '../git/gitApiInfos';
import { GitTypeEnum } from '../webhook/utils.enum';
import { GithubService } from '../github/github.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { GitRelease } from '../git/gitRelease';
import { Inject } from '@nestjs/common';
import { Visitor } from 'universal-analytics';

interface CreateReleaseArgs {
  name: string;
  tag: string;
  description: string;
  ref: string;
}

/**
 * `CreateReleaseRunnable` generate a `name` release related to a `tag`. You can add a description supporting markdown.
 */
@RunnableDecorator('CreateReleaseRunnable')
export class CreateReleaseRunnable extends Runnable {
  constructor(
    private readonly githubService: GithubService,
    private readonly gitlabService: GitlabService,
    @Inject('GoogleAnalytics')
    private readonly googleAnalytics: Visitor,
  ) {
    super();
  }

  async run(
    callbackType: CallbackType,
    ruleResult: RuleResult,
    args: CreateReleaseArgs,
  ): Promise<void> {
    const gitApiInfos: GitApiInfos = ruleResult.gitApiInfos;
    const gitRelease: GitRelease = new GitRelease();

    this.googleAnalytics
      .event('Runnable', 'createRelease', ruleResult.projectURL)
      .send();

    if (typeof args.tag === 'undefined') {
      return;
    }
    gitRelease.tag = render(args.tag, ruleResult);

    if (typeof args.name !== 'undefined') {
      gitRelease.name = render(args.name, ruleResult);
    }
    if (typeof args.description !== 'undefined') {
      gitRelease.description = render(args.description, ruleResult);
    }
    if (typeof args.ref !== 'undefined') {
      gitRelease.ref = render(args.ref, ruleResult);
    }

    if (gitApiInfos.git === GitTypeEnum.Github) {
      this.githubService.createRelease(gitRelease);
    } else if (gitApiInfos.git === GitTypeEnum.Gitlab) {
      this.gitlabService.createRelease(gitRelease);
    }
  }
}
