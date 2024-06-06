var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/functions/hello/handler.ts
var handler_exports = {};
__export(handler_exports, {
  main: () => main
});
module.exports = __toCommonJS(handler_exports);

// src/libs/api-gateway.ts
var SuccessJSONResponse = (response) => {
  return {
    statusCode: 200,
    body: JSON.stringify(response)
  };
};

// node_modules/@middy/core/index.js
var import_events = require("events");
var defaultLambdaHandler = () => {
};
var defaultPlugin = {
  timeoutEarlyInMillis: 5,
  timeoutEarlyResponse: () => {
    throw new Error("Timeout");
  }
};
var middy = (lambdaHandler = defaultLambdaHandler, plugin = {}) => {
  var _a;
  if (typeof lambdaHandler !== "function") {
    plugin = lambdaHandler;
    lambdaHandler = defaultLambdaHandler;
  }
  plugin = {
    ...defaultPlugin,
    ...plugin
  };
  plugin.timeoutEarly = plugin.timeoutEarlyInMillis > 0;
  (_a = plugin.beforePrefetch) == null ? void 0 : _a.call(plugin);
  const beforeMiddlewares = [];
  const afterMiddlewares = [];
  const onErrorMiddlewares = [];
  const middy2 = (event = {}, context = {}) => {
    var _a2;
    (_a2 = plugin.requestStart) == null ? void 0 : _a2.call(plugin);
    const request = {
      event,
      context,
      response: void 0,
      error: void 0,
      internal: plugin.internal ?? {}
    };
    return runRequest(request, [
      ...beforeMiddlewares
    ], lambdaHandler, [
      ...afterMiddlewares
    ], [
      ...onErrorMiddlewares
    ], plugin);
  };
  middy2.use = (middlewares) => {
    if (!Array.isArray(middlewares)) {
      middlewares = [
        middlewares
      ];
    }
    for (const middleware of middlewares) {
      const { before, after, onError } = middleware;
      if (!before && !after && !onError) {
        throw new Error('Middleware must be an object containing at least one key among "before", "after", "onError"');
      }
      if (before)
        middy2.before(before);
      if (after)
        middy2.after(after);
      if (onError)
        middy2.onError(onError);
    }
    return middy2;
  };
  middy2.before = (beforeMiddleware) => {
    beforeMiddlewares.push(beforeMiddleware);
    return middy2;
  };
  middy2.after = (afterMiddleware) => {
    afterMiddlewares.unshift(afterMiddleware);
    return middy2;
  };
  middy2.onError = (onErrorMiddleware) => {
    onErrorMiddlewares.unshift(onErrorMiddleware);
    return middy2;
  };
  middy2.handler = (replaceLambdaHandler) => {
    lambdaHandler = replaceLambdaHandler;
    return middy2;
  };
  return middy2;
};
var runRequest = async (request, beforeMiddlewares, lambdaHandler, afterMiddlewares, onErrorMiddlewares, plugin) => {
  var _a, _b, _c;
  const timeoutEarly = plugin.timeoutEarly && request.context.getRemainingTimeInMillis;
  try {
    await runMiddlewares(request, beforeMiddlewares, plugin);
    if (typeof request.response === "undefined") {
      (_a = plugin.beforeHandler) == null ? void 0 : _a.call(plugin);
      const handlerAbort = new AbortController();
      let timeoutAbort;
      if (timeoutEarly)
        timeoutAbort = new AbortController();
      request.response = await Promise.race([
        lambdaHandler(request.event, request.context, {
          signal: handlerAbort.signal
        }),
        timeoutEarly ? setTimeoutPromise(request.context.getRemainingTimeInMillis() - plugin.timeoutEarlyInMillis, {
          signal: timeoutAbort.signal
        }).then(() => {
          handlerAbort.abort();
          return plugin.timeoutEarlyResponse();
        }) : Promise.race([])
      ]);
      if (timeoutEarly)
        timeoutAbort.abort();
      (_b = plugin.afterHandler) == null ? void 0 : _b.call(plugin);
      await runMiddlewares(request, afterMiddlewares, plugin);
    }
  } catch (e1) {
    request.response = void 0;
    request.error = e1;
    try {
      await runMiddlewares(request, onErrorMiddlewares, plugin);
    } catch (e) {
      e.originalError = request.error;
      request.error = e;
      throw request.error;
    }
    if (typeof request.response === "undefined")
      throw request.error;
  } finally {
    await ((_c = plugin.requestEnd) == null ? void 0 : _c.call(plugin, request));
  }
  return request.response;
};
var runMiddlewares = async (request, middlewares, plugin) => {
  var _a, _b;
  for (const nextMiddleware of middlewares) {
    (_a = plugin.beforeMiddleware) == null ? void 0 : _a.call(plugin, nextMiddleware.name);
    const res = await nextMiddleware(request);
    (_b = plugin.afterMiddleware) == null ? void 0 : _b.call(plugin, nextMiddleware.name);
    if (typeof res !== "undefined") {
      request.response = res;
      return;
    }
  }
};
var polyfillAbortController = () => {
  if (process.version < "v15.0.0") {
    class AbortSignal {
      toString() {
        return "[object AbortSignal]";
      }
      get [Symbol.toStringTag]() {
        return "AbortSignal";
      }
      removeEventListener(name, handler) {
        this.eventEmitter.removeListener(name, handler);
      }
      addEventListener(name, handler) {
        this.eventEmitter.on(name, handler);
      }
      dispatchEvent(type) {
        const event = {
          type,
          target: this
        };
        const handlerName = `on${type}`;
        if (typeof this[handlerName] === "function")
          this[handlerName](event);
        this.eventEmitter.emit(type, event);
      }
      constructor() {
        this.eventEmitter = new import_events.EventEmitter();
        this.onabort = null;
        this.aborted = false;
      }
    }
    return class AbortController1 {
      abort() {
        if (this.signal.aborted)
          return;
        this.signal.aborted = true;
        this.signal.dispatchEvent("abort");
      }
      toString() {
        return "[object AbortController]";
      }
      get [Symbol.toStringTag]() {
        return "AbortController";
      }
      constructor() {
        this.signal = new AbortSignal();
      }
    };
  } else {
    return AbortController;
  }
};
global.AbortController = polyfillAbortController();
var polyfillSetTimeoutPromise = () => {
  return (ms, { signal }) => {
    if (signal.aborted) {
      return Promise.reject(new Error("Aborted", "AbortError"));
    }
    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error("Aborted", "AbortError"));
      };
      const timeout = setTimeout(() => {
        resolve();
        signal.removeEventListener("abort", abortHandler);
      }, ms);
      signal.addEventListener("abort", abortHandler);
    });
  };
};
var setTimeoutPromise = polyfillSetTimeoutPromise();
var core_default = middy;

// node_modules/@middy/util/index.js
var import_https = require("https");
var awsClientDefaultOptions = {
  httpOptions: {
    agent: new import_https.Agent({
      keepAlive: true,
      secureProtocol: "TLSv1_2_method"
    })
  }
};
var createErrorRegexp = /[^a-zA-Z]/g;
var HttpError = class extends Error {
  constructor(code, message, options = {}) {
    if (message && typeof message !== "string") {
      options = message;
      message = void 0;
    }
    message ?? (message = httpErrorCodes[code]);
    super(message);
    this.cause = options.cause;
    const name = httpErrorCodes[code].replace(createErrorRegexp, "");
    this.name = name.substr(-5) !== "Error" ? name + "Error" : name;
    this.status = this.statusCode = code;
    this.expose = options.expose ?? code < 500;
  }
};
var createError = (code, message, properties = {}) => {
  return new HttpError(code, message, properties);
};
var httpErrorCodes = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  306: "(Unused)",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Unordered Collection",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended",
  511: "Network Authentication Required"
};

// node_modules/@middy/http-json-body-parser/index.js
var mimePattern = /^application\/(.+\+)?json(;.*)?$/;
var defaults = {
  reviver: void 0
};
var httpJsonBodyParserMiddleware = (opts = {}) => {
  const { reviver } = {
    ...defaults,
    ...opts
  };
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event;
    const contentType = headers["Content-Type"] ?? headers["content-type"];
    if (!mimePattern.test(contentType))
      return;
    try {
      const data = request.event.isBase64Encoded ? Buffer.from(body, "base64").toString() : body;
      request.event.rawBody = body;
      request.event.body = JSON.parse(data, reviver);
    } catch (cause) {
      const error = createError(422, "Invalid or malformed JSON was provided");
      error.cause = cause;
      throw error;
    }
  };
  return {
    before: httpJsonBodyParserMiddlewareBefore
  };
};
var http_json_body_parser_default = httpJsonBodyParserMiddleware;

// src/libs/lambda.ts
var middyfy = (handler) => core_default(handler).use(http_json_body_parser_default());

// src/functions/hello/handler.ts
var hello = async (event) => {
  return SuccessJSONResponse({
    message: `Hello ${event.body.name}, welcome to the exciting Serverless world!`,
    event
  });
};
var main = middyfy(hello);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
//# sourceMappingURL=handler.js.map
