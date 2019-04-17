import {
  Controller,
  Body,
  Post,
  UseInterceptors,
  Get,
  Res,
  HttpStatus,
  UseFilters,
  Header,
  HttpService,
  Param,
} from '@nestjs/common';
import { Webhook } from './webhook/webhook';
import { WebhookInterceptor } from './webhook/webhook.interceptor';
import { logger } from './logger/logger.service';
import { RulesService } from './rules/rules.service';
import { GitTypeEnum, GitEventEnum } from './webhook/utils.enum';
import { AllExceptionsFilter } from './exceptions/allExceptionFilter';
import { PreconditionException } from './exceptions/precondition.exception';
import { getAllRules } from './generator/getAllRules';
import { getAllRunnables } from './generator/getAllRunnables';
import { getAllOptions } from './generator/getAllOptions';
import { GitlabService } from './gitlab/gitlab.service';
import { GithubService } from './github/github.service';
import { RemoteConfigUtils } from './remote-config/utils';
import { Utils } from './utils/utils';
import { ScheduleService } from './scheduler/scheduler.service';
import { NestSchedule } from 'nest-schedule';
import { Schedule, ScheduleInformations } from './scheduler/schedule';

@Controller()
export class AppController {
  constructor(
    private readonly httpService: HttpService,
    private readonly rulesService: RulesService,
    private readonly githubService: GithubService,
    private readonly gitlabService: GitlabService,
    private readonly scheduleService: ScheduleService,
  ) {}

  @Get('/')
  welcome(): string {
    return (
      '<p><b>Git Webhooks</b> is running!</p>' +
      '<p>Have a look at our <a href="https://dx-developerexperience.github.io/git-webhooks/">documentation</a> for more informations.</p>'
    );
  }

  @Post('/config-env')
  postConfigEnv(@Body() body: any, @Res() response): void {
    const configEnv = {
      gitApi: body.gitApi,
      gitToken: body.gitToken,
      gitRepo: body.gitRepo,
    };
    response.send(RemoteConfigUtils.registerConfigEnv(configEnv));
  }

  @Get('/rules')
  @Header('Access-Control-Allow-Origin', '*')
  getAllRules(): object {
    return getAllRules();
  }

  @Get('/runnables')
  @Header('Access-Control-Allow-Origin', '*')
  getAllRunnables(): object {
    return getAllRunnables();
  }

  @Get('/options')
  @Header('Access-Control-Allow-Origin', '*')
  getAllOptions(): object {
    return getAllOptions();
  }

  @Post('/webhook')
  @UseInterceptors(WebhookInterceptor)
  @UseFilters(AllExceptionsFilter)
  async processWebhook(
    @Body() webhook: Webhook,
    @Res() response,
  ): Promise<void> {
    if (
      webhook.getGitType() === GitTypeEnum.Undefined ||
      webhook.getGitEvent() === GitEventEnum.Undefined
    ) {
      throw new PreconditionException();
    } else {
      Utils.loadEnv('config.env');
      const getRemoteRules: string = process.env.ALLOW_REMOTE_CONFIG;

      const remoteRepository =
        getRemoteRules === 'true'
          ? RemoteConfigUtils.downloadRulesFile(
              this.httpService,
              webhook.getCloneURL(),
            )
          : 'src/rules';

      try {
        const remoteEnvs: string = webhook.getRemoteDirectory();
        this.githubService.setEnvironmentVariables(remoteEnvs);
        this.gitlabService.setEnvironmentVariables(remoteEnvs);
      } catch (e) {
        if (e instanceof PreconditionException) {
          logger.error(
            'There is no config.env file for the current git project',
          );
          return;
        } else {
          throw e;
        }
      }

      logger.info(
        `\n\n=== processWebhook - ${webhook.getGitType()} - ${webhook.getGitEvent()} ===\n`,
      );

      const result = await this.rulesService.testRules(
        webhook,
        remoteRepository,
      );
      response.status(HttpStatus.ACCEPTED).send(result);
    }
  }

  @Post('cron')
  async cronJobs(@Body() body: any, @Res() response): Promise<void> {
    const name: string = body.name;
    const infos: ScheduleInformations = body.infos;
    if (this.scheduleService.createSchedule(name, infos)) {
      response.send('Schedule successfully created');
    } else {
      response.send('Cannot create Schedule...');
    }
  }
}
