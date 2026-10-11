type QueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const queue: QueueItem<any>[] = [];
let processing = false;

const processNext = async () => {
  if (processing) {
    return;
  }

  const item = queue.shift();

  if (!item) {
    return;
  }

  processing = true;

  try {
    const result = await item.task();
    item.resolve(result);
  } catch (error) {
    item.reject(error);
  } finally {
    processing = false;
    processNext();
  }
};

export const ejecutarPreviewEnCola = <T>(
  task: () => Promise<T>
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      task,
      resolve,
      reject
    });

    processNext();
  });
};