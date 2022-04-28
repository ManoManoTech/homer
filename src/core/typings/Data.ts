export interface DataProject {
  channelId: string;
  projectId: number;
}

export interface DataReview {
  channelId: string;
  mergeRequestIid: number;
  projectId: number;
  ts: string;
}

export interface InternalDataModel {
  id: number;
  createdAt: string;
  updatedAt: string;
}
