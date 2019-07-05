import { Runnable } from './runnable.class';
import { RuleResult } from '../rules/ruleResult';
import { GithubService } from '../github/github.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { GitTypeEnum } from '../webhook/utils.enum';
import { GitPRInfos } from '../git/gitPRInfos';
import { render } from 'mustache';
import { CallbackType } from './runnables.service';
import { GitApiInfos } from '../git/gitApiInfos';
import { RunnableDecorator } from './runnable.decorator';
import { Inject } from '@nestjs/common';
import { Visitor } from 'universal-analytics';

interface CreatePullRequestArgs {
  title: string;
  description: string;
  source: string;
  target: string;
  draft: boolean | string;
}

/**
 * `CreatePullRequestRunnable` creates a new PR or MR.
 */
@RunnableDecorator('CreatePullRequestRunnable')
export class CreatePullRequestRunnable extends Runnable {
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
    args: CreatePullRequestArgs,
  ): Promise<void> {
    const gitApiInfos: GitApiInfos = ruleResult.gitApiInfos;

    this.googleAnalytics
      .event('Runnable', 'createPullRequest', ruleResult.projectURL)
      .send();

    const gitCreatePRInfos: GitPRInfos = new GitPRInfos();

    if (typeof args.title === 'undefined') {
      return;
    }

    // Defaults
    if (typeof args.description === 'undefined') {
      args.description = '';
    }
    if (typeof args.source === 'undefined') {
      args.source = '{{data.branch}}';
    }
    if (typeof args.target === 'undefined') {
      args.target = 'master';
    }

    gitCreatePRInfos.description = render(args.description, ruleResult).replace(
      /&#x2F;/g,
      '/',
    );
    gitCreatePRInfos.title = render(args.title, ruleResult).replace(
      /&#x2F;/g,
      '/',
    );
    gitCreatePRInfos.source = render(args.source, ruleResult).replace(
      /&#x2F;/g,
      '/',
    );
    gitCreatePRInfos.target = render(args.target, ruleResult).replace(
      /&#x2F;/g,
      '/',
    );
    if (typeof args.draft === 'string') {
      gitCreatePRInfos.draft = render(args.draft, ruleResult);
    } else if (typeof args.draft === 'boolean') {
      gitCreatePRInfos.draft = args.draft;
    }

    if (gitApiInfos.git === GitTypeEnum.Github) {
      this.githubService.createPullRequest(gitCreatePRInfos);
    } else if (gitApiInfos.git === GitTypeEnum.Gitlab) {
      this.gitlabService.createPullRequest(gitCreatePRInfos);
    }
  }
}
