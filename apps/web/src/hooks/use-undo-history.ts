import { useCallback, useRef } from "react";

type UndoFn = () => Promise<void> | void;

export function useUndoHistory(maxSize = 50) {
  const stack = useRef<UndoFn[]>([]);

  const push = useCallback((fn: UndoFn) => {
    stack.current.push(fn);
    if (stack.current.length > maxSize) stack.current.shift();
  }, [maxSize]);

  const undo = useCallback(async () => {
    const fn = stack.current.pop();
    if (fn) await fn();
  }, []);

  const clear = useCallback(() => {
    stack.current = [];
  }, []);

  const canUndo = useCallback(() => stack.current.length > 0, []);

  return { push, undo, clear, canUndo };
}
