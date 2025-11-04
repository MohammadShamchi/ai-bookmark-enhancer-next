const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 200;
const DEFAULT_TIMEOUT = 2500;

const RECOVERABLE_PATTERNS = [
  'Receiving end does not exist',
  'Could not establish connection',
  'The message port closed before a response was received',
  'Extension context invalidated',
  'No receiving end',
  'Message manager disconnected',
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverable(error) {
  if (!error) {
    return false;
  }
  const message = error.message || String(error);
  return RECOVERABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

function sendMessageOnce(message, { timeout = DEFAULT_TIMEOUT, expectResponse = true } = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timerId = null;

    if (expectResponse && timeout > 0) {
      timerId = setTimeout(() => {
        if (finished) return;
        finished = true;
        reject(new Error('MESSAGE_TIMEOUT'));
      }, timeout);
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (finished) {
          return;
        }

        finished = true;
        if (timerId) {
          clearTimeout(timerId);
        }

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(response);
      });
    } catch (error) {
      if (finished) return;
      finished = true;
      if (timerId) {
        clearTimeout(timerId);
      }
      reject(error);
    }
  });
}

export async function sendRuntimeMessage(message, options = {}) {
  const {
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await sendMessageOnce(message, { timeout, expectResponse: true });
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < retries && (error.message === 'MESSAGE_TIMEOUT' || isRecoverable(error));
      if (!shouldRetry) {
        throw error;
      }
      await delay(retryDelay * (attempt + 1));
    }
    attempt += 1;
  }

  throw lastError ?? new Error('UNKNOWN_MESSAGE_FAILURE');
}

export function emitRuntimeMessage(message, options = {}) {
  const {
    timeout = 0,
    logErrors = true,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
  } = options;

  let attempt = 0;

  const send = () => {
    sendMessageOnce(message, { timeout, expectResponse: false }).catch(async (error) => {
      const shouldRetry = attempt < retries && isRecoverable(error);
      if (shouldRetry) {
        attempt += 1;
        await delay(retryDelay * attempt);
        send();
        return;
      }

      if (logErrors) {
        console.debug('[runtime_bus] Failed to emit message', error);
      }
    });
  };

  send();
}

export function addRuntimeMessageListener(handler) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let result;

    try {
      result = handler(message, sender);
    } catch (error) {
      console.error('[runtime_bus] Listener threw synchronously', error);
      try {
        sendResponse({ ok: false, error: error?.message ?? 'UNKNOWN_ERROR' });
      } catch (sendError) {
        console.error('[runtime_bus] Failed to send error response', sendError);
      }
      return true;
    }

    if (result === undefined) {
      return false;
    }

    if (typeof result?.then === 'function') {
      result
        .then((value) => {
          sendResponse(value);
        })
        .catch((error) => {
          console.error('[runtime_bus] Listener rejected', error);
          sendResponse({ ok: false, error: error?.message ?? 'UNKNOWN_ERROR' });
        });
      return true;
    }

    sendResponse(result);
    return true;
  });
}
