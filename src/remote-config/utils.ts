import { logger } from '../logger/logger.service';
import { HttpService, HttpException, HttpStatus } from '@nestjs/common';
import { GitTypeEnum } from '../webhook/utils.enum';
import { Utils } from '../utils/utils';

const fs = require('fs-extra');

interface ConfigEnv {
  gitRepo: string;
  gitApi: string;
  gitToken: string;
}

export class RemoteConfigUtils {
  private static getPath(splitedURL: string[]): string {
    return (
      splitedURL[splitedURL.length - 2] +
      '/' +
      splitedURL[splitedURL.length - 1].replace('.git', '')
    );
  }

  /**
   * Download the `rules.yml` from the repository associate to the `projectURL`.
   * @param projectURL
   * @return the location of the `.git-webhooks` repo
   */
  static async downloadRulesFile(
    httpService: HttpService,
    projectURL: string,
    filename: string,
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const whichGit: GitTypeEnum =
        projectURL.indexOf('github.com') > -1
          ? GitTypeEnum.Github
          : projectURL.indexOf('gitlab.com') > -1
          ? GitTypeEnum.Gitlab
          : GitTypeEnum.Undefined;

      let rulesFilePath: string;
      switch (whichGit) {
        case GitTypeEnum.Github:
          rulesFilePath = `https://raw.githubusercontent.com/${this.getPath(
            projectURL.split('/'),
          )}/master/.git-webhooks/${filename}`;
          break;
        case GitTypeEnum.Gitlab:
          rulesFilePath = `${projectURL.replace(
            '.git',
            '',
          )}/raw/master/.git-webhooks/${filename}`;
          break;
      }

      const gitWebhooksFolder: string =
        'remote-rules/' +
        this.getPath(projectURL.split('/')) +
        '/.git-webhooks';

      try {
        await httpService
          .get(rulesFilePath)
          .toPromise()
          .then(response => {
            return new Promise(async (res, rej) => {
              await Utils.writeFileSync(
                `${gitWebhooksFolder}/${filename}`,
                response.data,
              );
              res(gitWebhooksFolder);
            });
          })
          .catch(err => {
            return new Promise(async (res, rej) => {
              logger.error(err);
              if (filename === 'rules.yml') {
                logger.warn('No rules.yml file found.\nUse the default one.');
                await Utils.writeFileSync(
                  `${gitWebhooksFolder}/rules.yml`,
                  fs.readFileSync('src/rules/rules.yml'),
                );
                res(gitWebhooksFolder);
              } else {
                rej(`${filename} do not exist!`);
              }
            }).catch(e => {
              throw new Error(e);
            });
          });
        resolve(gitWebhooksFolder);
      } catch (e) {
        logger.error(e);
        reject(e);
      }
    });
  }

  /**
   * Create the `config.env` file with `gitApi` URL and the corresponding `gitToken`
   * @return an Object with the success status (true if registration succeed, false otherwise) and if the file already exist
   */
  static registerConfigEnv(configEnv: ConfigEnv): any {
    const result: any = {
      succeed: true,
      alreadyExist: false,
    };

    const configFile: string =
      'remote-envs/' +
      this.getPath(configEnv.gitRepo.split('/')) +
      '/config.env';

    const content: string = `gitApi=${configEnv.gitApi}
gitToken=${configEnv.gitToken}`;

    const path = require('path');

    if (fs.existsSync(configFile)) {
      result.alreadyExist = true;
    }

    Utils.writeFileSync(configFile, content);

    return result;
  }
}
