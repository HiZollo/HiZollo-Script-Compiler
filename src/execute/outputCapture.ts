import { StringDecoder } from 'node:string_decoder';
import { ExecutionError, ExecutionErrorCode } from './executionError';
import type { ExecutionOutputLimitBehavior } from '../types/interfaces'

export interface ExecutionOutputCapture {
  output: string;
  decoder: StringDecoder;
  stopped: boolean;
  exceeded: boolean;
  name: string;
  code: ExecutionErrorCode;
  limit: number | undefined;
  onLimit: ExecutionOutputLimitBehavior;
  pending: string;
  segments: string[];
  segmentHead: number;
}

export class ExecutionOutputExceededLimitError extends ExecutionError {
  constructor(public readonly capture: ExecutionOutputCapture) {
    super(`Execution exceeded the ${capture.name} output limit`, capture.code);
  }
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme'
});

type OnHaltCallback = (_: ExecutionOutputCapture) => void

function exceedOutput(target: ExecutionOutputCapture, onHalt: OnHaltCallback) {
  target.exceeded = true;
  target.stopped = true;
  target.pending = '';
  target.output = target.segments.join('');

  if (target.onLimit === 'halt') onHalt(target)
}

function commitGrapheme(target: ExecutionOutputCapture, segment: string, onHalt: OnHaltCallback) {
  const limit = target.limit!;

  if (target.onLimit === 'roll') {
    if (limit === 0) {
      target.exceeded = true;
      return;
    }

    if (target.segments.length < limit) {
      target.segments.push(segment);
      return;
    }

    target.segments[target.segmentHead] = segment;
    target.segmentHead = (target.segmentHead + 1) % limit;
    target.exceeded = true;
    return;
  }

  if (target.segments.length < limit) {
    target.segments.push(segment);
    return;
  }

  exceedOutput(target, onHalt);
}

function captureLimitedText(target: ExecutionOutputCapture, text: string, final: boolean, onHalt: OnHaltCallback) {
  const combined = target.pending + text;
  if (combined.length === 0) return;

  let previous: string | undefined;

  for (const { segment } of graphemeSegmenter.segment(combined)) {
    if (previous !== undefined) {
      commitGrapheme(target, previous, onHalt);
      if (target.stopped) return;
    }

    previous = segment;
  }

  if (final) {
    if (previous !== undefined) commitGrapheme(target, previous, onHalt);
    target.pending = '';

    if (!target.stopped) {
      if (target.onLimit === 'roll' && target.segmentHead > 0) {
        target.output = target.segments
          .slice(target.segmentHead)
          .concat(target.segments.slice(0, target.segmentHead))
          .join('');
      } else {
        target.output = target.segments.join('');
      }
    }
    return;
  }

  target.pending = previous ?? '';
  if (!target.pending) return;

  if (target.onLimit === 'roll') {
    if (target.limit === 0 || target.segments.length >= target.limit!) {
      target.exceeded = true;
    }
  } else if (target.segments.length >= target.limit!) {
    exceedOutput(target, onHalt);
  }
}

export function captureOutput(target: ExecutionOutputCapture, chunk: Buffer | null, onHalt: OnHaltCallback) {
  const text = chunk === null ? target.decoder.end() : target.decoder.write(chunk);
  if (target.stopped) return;

  if (target.limit === undefined) {
    target.output += text;
    return;
  }

  captureLimitedText(target, text, chunk === null, onHalt);
}

type CreateOutputCaptureConfig = { 
  name: string
  code: ExecutionErrorCode
} & Pick<ExecutionOutputCapture, "limit" | "onLimit">

export function createOutputCapture(config: CreateOutputCaptureConfig): ExecutionOutputCapture {
  return {
    output: '',
    decoder: new StringDecoder('utf-8'),
    stopped: false,
    exceeded: false,
    pending: '',
    segments: [],
    segmentHead: 0,
    ...config
  }
}
