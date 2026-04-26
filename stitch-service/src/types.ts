export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface StitchRequest {
  scenes:      string[];          // ordered list of video URLs
  transitions?: 'cut' | 'fade';  // default: cut
  audio?:      string;            // optional background audio URL
  format?:     '9:16' | '16:9' | '1:1'; // default: 9:16
}

export interface Job {
  id:          string;
  status:      JobStatus;
  request:     StitchRequest;
  videoUrl?:   string;
  duration?:   number;
  scenes?:     number;
  error?:      string;
  createdAt:   number;
  completedAt?: number;
}

export interface StitchResponse {
  jobId:    string;
  status:   JobStatus;
  videoUrl?: string;
  duration?: number;
  scenes?:  number;
  error?:   string;
}
