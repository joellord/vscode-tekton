/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

//Contains set JSON representation of tkn JSON objects

export interface TknMetadata {
  name: string;
  generation?: number;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
}

export interface TknParams {
  name: string;
  value: string;
  default: string;
  description: string;
}

export interface TknResource {
  name: string;
  type: string;
}

export interface TknSpec {
  type: string;
  resources?: TknResource[];
  params?: TknParams[];
  serviceAccount?: string;
}

export interface TknTaskSpec {
  inputs?: TknInputs;
  outputs?: TknOutputs;
  steps: Array;
}

export interface ParamSpec {
  name: string;
  type?: string;
  description?: string;
  default?: string | string[];
}

export interface TknInputs {
  resources?: TaskResource[];
  params?: ParamSpec[];
}

export interface TknOutputs {
  results?: {};
  resources?: TaskResource[];
}

export interface TaskResource {
  name: string;
  type: string;
  description?: string;
  targetPath?: string;
  optional?: boolean;
}


export interface TknPipelineTrigger {
  metadata: TknMetadata;
  spec: TknSpec;
}

export interface TknPipelineResource {
  metadata: TknMetadata;
  spec: TknSpec;
}

export interface TknTask {
  kind: string;
  metadata: TknMetadata;
  spec: TknTaskSpec;
}

// JSON types

export type PipelineRunData = {
  metadata: {
    creationTimestamp: string;
    name: string;
    generateName: string;
  };
  spec: {
    pipelineRef: {
      name: string;
    };
  };
  status: {
    completionTime: string;
    conditions: PipelineRunConditions[];
    taskRuns: TaskRuns;
  };
};

export interface TaskRuns {
  [key: string]: TaskRun;
}

export interface TaskRun {
  pipelineTaskName: string;
  status: TaskRunStatus;
}

export interface TaskRunStatus {
  conditions: PipelineRunConditions[];
  startTime?: string;
  completionTime?: string;
  steps: TaskRunSteps[];
}

export interface PipelineRunConditions {
  message: string;
  reason: string;
  status: string;
  type: string;
}

export interface TaskRunSteps {
  name: string;
  container: string;
  //TODO: ass all fields
  terminated: {};
  waiting: {};
}
