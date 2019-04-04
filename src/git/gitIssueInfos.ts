export enum IssueStateEnum {
  Open = 'Open',
  Close = 'Close',
  Undefined = 'Undefined',
}

/**
 * Provide all informations needed to interact with an Issue via a git API
 */
export class GitIssueInfos {
  comment: string;
  number: string;
  title: string;
  state: IssueStateEnum;
  labels: string[];
  assignees: string[];
  description: string;
}
