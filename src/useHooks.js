import { useState, useEffect, useRef, useLayoutEffect,useCallback,useReducer,useMemo,useSyncExternalStore } from "react";

function isShallowEqual(object1, object2) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    if (object1[key] !== object2[key]) {
      return false;
    }
  }

  return true;
}

function isTouchEvent({ nativeEvent }) {
  return window.TouchEvent ? nativeEvent instanceof TouchEvent : "touches" in nativeEvent;
}

function isMouseEvent(event) {
  return event.nativeEvent instanceof MouseEvent;
}

function throttle(cb, ms) {
  let lastTime = 0;
  return () => {
    const now = Date.now();
    if (now - lastTime >= ms) {
      cb();
      lastTime = now;
    }
  };
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function dispatchStorageEvent(key, newValue) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

export function useBattery() {
  const [state, setState] = useState({
    supported: true,
    loading: true,
    level: null,
    charging: null,
    chargingTime: null,
    dischargingTime: null,
  });

  useEffect(() => {
    if (!navigator.getBattery) {
      setState((s) => ({
        ...s,
        supported: false,
        loading: false,
      }));
      return;
    }

    let battery = null;

    const handleChange = () => {
      setState({
        supported: true,
        loading: false,
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      });
    };

    navigator.getBattery().then((b) => {
      battery = b;
      handleChange();

      b.addEventListener("levelchange", handleChange);
      b.addEventListener("chargingchange", handleChange);
      b.addEventListener("chargingtimechange", handleChange);
      b.addEventListener("dischargingtimechange", handleChange);
    });

    return () => {
      if (battery) {
        battery.removeEventListener("levelchange", handleChange);
        battery.removeEventListener("chargingchange", handleChange);
        battery.removeEventListener("chargingtimechange", handleChange);
        battery.removeEventListener("dischargingtimechange", handleChange);
      }
    };
  }, []);

  return state;
}

export function useClickAway(cb) {
  const ref = useRef(null);
  const refCb = useRef(cb);

  useLayoutEffect(() => {
    refCb.current = cb;
  });

  useEffect(() => {
    const handler = (e) => {
      const element = ref.current;
      if (element && !element.contains(e.target)) {
        refCb.current(e);
      }
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  return ref;
}

function oldSchoolCopy(text) {
  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = text;
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  document.execCommand("copy");
  document.body.removeChild(tempTextArea);
}

export function useCopyToClipboard() {
  const [state, setState] = useState(null);

  const copyToClipboard = useCallback((value) => {
    const handleCopy = async () => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          setState(value);
        } else {
          throw new Error("writeText not supported");
        }
      } catch (e) {
        oldSchoolCopy(value);
        setState(value);
      }
    };

    handleCopy();
  }, []);

  return [state, copyToClipboard];
}

export function useContinuousRetry(callback, interval = 100, options = {}) {
  const { maxRetries = Infinity } = options;
  const [hasResolved, setHasResolved] = useState(false);
  const onInterval = useCallback(() => {
    return callback();
  }, [callback]);

  useEffect(() => {
    let retries = 0;

    const id = window.setInterval(() => {
      if (onInterval()) {
        setHasResolved(true);
        window.clearInterval(id);
      } else if (retries >= maxRetries) {
        window.clearInterval(id);
      } else {
        retries += 1;
      }
    }, interval);

    return () => window.clearInterval(id);
  }, [interval, maxRetries, onInterval]);

  return hasResolved;
}

export function useCountdown(endTime, options) {
  const [count, setCount] = useState(null);
  const intervalIdRef = useRef(null);

  const handleClearInterval = () => {
    window.clearInterval(intervalIdRef.current);
  };

  const onTick = useCallback(() => {
    if (count === 0) {
      handleClearInterval();
      options.onComplete();
    } else {
      setCount(count - 1);
      options.onTick();
    }
  }, [count, options]);

  useEffect(() => {
    intervalIdRef.current = window.setInterval(onTick, options.interval);

    return () => handleClearInterval();
  }, [onTick, options.interval]);

  useEffect(() => {
    setCount(Math.round((endTime - Date.now()) / options.interval));
  }, [endTime, options.interval]);

  return count;
}

export function useCounter(startingValue = 0, options = {}) {
  const { min, max } = options;

  if (typeof min === "number" && startingValue < min) {
    throw new Error(`Your starting value of ${startingValue} is less than your min of ${min}.`);
  }

  if (typeof max === "number" && startingValue > max) {
    throw new Error(`Your starting value of ${startingValue} is greater than your max of ${max}.`);
  }

  const [count, setCount] = useState(startingValue);

  const increment = useCallback(() => {
    setCount((c) => {
      const nextCount = c + 1;

      if (typeof max === "number" && nextCount > max) {
        return c;
      }

      return nextCount;
    });
  }, [max]);

  const decrement = useCallback(() => {
    setCount((c) => {
      const nextCount = c - 1;

      if (typeof min === "number" && nextCount < min) {
        return c;
      }

      return nextCount;
    });
  }, [min]);

  const set = useCallback(
    (nextCount) => {
      setCount((c) => {
        if (typeof max === "number" && nextCount > max) {
          return c;
        }

        if (typeof min === "number" && nextCount < min) {
          return c;
        }

        return nextCount;
      });
    },
    [max, min]
  );

  const reset = useCallback(() => {
    setCount(startingValue);
  }, [startingValue]);

  return [count,{
      increment,
      decrement,
      set,
      reset,
    },
  ];
}

export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDefault(initialValue, defaultValue) {
  const [state, setState] = useState(initialValue);

  if (typeof state === "undefined" || state === null) {
    return [defaultValue, setState];
  }

  return [state, setState];
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export function useEventListener(target, eventName, handler, options) {
  const onEvent = useCallback((event) => {
    handler(event);
  }, [handler]);

  useEffect(() => {
    const targetElement = target.current ?? target;

    if (!targetElement?.addEventListener) return;

    targetElement.addEventListener(eventName, onEvent, options);

    return () => {
      targetElement.removeEventListener(eventName, onEvent, options);
    };
  }, [target, eventName, options, onEvent]);
}

export function useFavicon(url) {
  useEffect(() => {
    let link = document.querySelector(`link[rel~="icon"]`);

    if (!link) {
      link = document.createElement("link");
      link.type = "image/x-icon";
      link.rel = "icon";
      link.href = url;
      document.head.appendChild(link);
    } else {
      link.href = url;
    }
  }, [url]);
}

const useFetchInitialState = {
  error: undefined,
  data: undefined,
};

const useFetchReducer = (state, action) => {
  switch (action.type) {
    case "loading":
      return { ...useFetchInitialState };
    case "fetched":
      return { ...useFetchInitialState, data: action.payload };
    case "error":
      return { ...useFetchInitialState, error: action.payload };
    default:
      return state;
  }
};

export function useFetch(url, options) {
  const cacheRef = useRef({});

  const [state, dispatch] = useReducer(useFetchReducer, useFetchInitialState);

  const onFetch = useCallback((url) => {
    return fetch(url, options);
  }, [options]);

  useEffect(() => {
    if (typeof url !== "string") return;

    let ignore = false;

    const fetchData = async () => {
      const cachedResponse = cacheRef.current[url];

      if (cachedResponse) {
        dispatch({ type: "fetched", payload: cachedResponse });
        return;
      }

      dispatch({ type: "loading" });

      try {
        const res = await onFetch(url);

        if (!res.ok) {
          throw new Error(res.statusText);
        }

        const json = await res.json();
        cacheRef.current[url] = json;

        if (ignore === false) {
          dispatch({ type: "fetched", payload: json });
        }
      } catch (e) {
        if (ignore === false) {
          dispatch({ type: "error", payload: e });
        }
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [onFetch, url]);

  return state;
}

export function useGeolocation(options = {}) {
  const [state, setState] = useState({
    loading: true,
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    latitude: null,
    longitude: null,
    speed: null,
    timestamp: null,
    error: null,
  });

  const optionsRef = useRef(options);

  useEffect(() => {
    const onEvent = ({ coords, timestamp }) => {
      setState({
        loading: false,
        timestamp,
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude,
        accuracy: coords.accuracy,
        altitudeAccuracy: coords.altitudeAccuracy,
        heading: coords.heading,
        speed: coords.speed,
      });
    };

    const onEventError = (error) => {
      setState((s) => ({
        ...s,
        loading: false,
        error,
      }));
    };

    navigator.geolocation.getCurrentPosition(
      onEvent,
      onEventError,
      optionsRef.current
    );

    const watchId = navigator.geolocation.watchPosition(
      onEvent,
      onEventError,
      optionsRef.current
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return state;
}

const initialUseHistoryStateState = {
  past: [],
  present: null,
  future: [],
};

const useHistoryStateReducer = (state, action) => {
  const { past, present, future } = state;

  if (action.type === "UNDO") {
    return {
      past: past.slice(0, past.length - 1),
      present: past[past.length - 1],
      future: [present, ...future],
    };
  } else if (action.type === "REDO") {
    return {
      past: [...past, present],
      present: future[0],
      future: future.slice(1),
    };
  } else if (action.type === "SET") {
    const { newPresent } = action;

    if (action.newPresent === present) {
      return state;
    }

    return {
      past: [...past, present],
      present: newPresent,
      future: [],
    };
  } else if (action.type === "CLEAR") {
    return {
      ...initialUseHistoryStateState,
      present: action.initialPresent,
    };
  } else {
    throw new Error("Unsupported action type");
  }
};

export function useHistoryState(initialPresent = {}) {
  const initialPresentRef = useRef(initialPresent);

  const [state, dispatch] = useReducer(useHistoryStateReducer, {
    ...initialUseHistoryStateState,
    present: initialPresentRef.current,
  });

  const canUndo = state.past.length !== 0;
  const canRedo = state.future.length !== 0;

  const undo = useCallback(() => {
    if (canUndo) {
      dispatch({ type: "UNDO" });
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      dispatch({ type: "REDO" });
    }
  }, [canRedo]);

  const set = useCallback((newPresent) => dispatch({ type: "SET", newPresent }),[]);

  const clear = useCallback(() =>
      dispatch({ type: "CLEAR", initialPresent: initialPresentRef.current }),
    []
  );

  return { state: state.present, set, undo, redo, clear, canUndo, canRedo };
}

export function useHover() {
  const [hovering, setHovering] = useState(false);
  const previousNode = useRef(null);

  const handleMouseEnter = useCallback(() => {
    setHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovering(false);
  }, []);

  const customRef = useCallback((node) => {
      if (previousNode.current?.nodeType === Node.ELEMENT_NODE) {
        previousNode.current.removeEventListener("mouseenter",handleMouseEnter);
        previousNode.current.removeEventListener("mouseleave",handleMouseLeave);
      }

      if (node?.nodeType === Node.ELEMENT_NODE) {
        node.addEventListener("mouseenter", handleMouseEnter);
        node.addEventListener("mouseleave", handleMouseLeave);
      }

      previousNode.current = node;
    },
    [handleMouseEnter, handleMouseLeave]
  );

  return [customRef, hovering];
}

export function useIdle(ms = 1000 * 60) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timeoutId;

    const handleTimeout = () => {
      setIdle(true);
    };

    const handleEvent = throttle(() => {
      setIdle(false);

      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleTimeout, ms);
    }, 500);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleEvent();
      }
    };

    timeoutId = window.setTimeout(handleTimeout, ms);

    window.addEventListener("mousemove", handleEvent);
    window.addEventListener("mousedown", handleEvent);
    window.addEventListener("resize", handleEvent);
    window.addEventListener("keydown", handleEvent);
    window.addEventListener("touchstart", handleEvent);
    window.addEventListener("wheel", handleEvent);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", handleEvent);
      window.removeEventListener("mousedown", handleEvent);
      window.removeEventListener("resize", handleEvent);
      window.removeEventListener("keydown", handleEvent);
      window.removeEventListener("touchstart", handleEvent);
      window.removeEventListener("wheel", handleEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearTimeout(timeoutId);
    };
  }, [ms]);

  return idle;
}

export function useIntersectionObserver(options = {}) {
  const { threshold = 1, root = null, rootMargin = "0px" } = options;
  const [entry, setEntry] = useState(null);

  const previousObserver = useRef(null);

  const customRef = useCallback((node) => {
      if (previousObserver.current) {
        previousObserver.current.disconnect();
        previousObserver.current = null;
      }

      if (node?.nodeType === Node.ELEMENT_NODE) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            setEntry(entry);
          },{ threshold, root, rootMargin }
        );

        observer.observe(node);
        previousObserver.current = observer;
      }
    },
    [threshold, root, rootMargin]
  );

  return [customRef, entry];
}

export function useInterval(cb, ms) {
  const id = useRef(null);
  const onInterval = useCallback(() => {
    cb();
  }, [cb]);

  const handleClearInterval = useCallback(() => {
    window.clearInterval(id.current);
  }, []);

  useEffect(() => {
    id.current = window.setInterval(onInterval, ms);
    return handleClearInterval;
  }, [ms, handleClearInterval, onInterval]);

  return handleClearInterval;
}

export function useIntervalWhen(cb, { ms, when, startImmediately }) {
  const id = useRef(null);
  const onTick = useCallback(() => {
    cb();
  }, [cb]);
  const immediatelyCalled = useRef(
    startImmediately === true ? false : null
  );

  const handleClearInterval = useCallback(() => {
    window.clearInterval(id.current);
    immediatelyCalled.current = false;
  }, []);

  useEffect(() => {
    if (when === true) {
      id.current = window.setInterval(onTick, ms);

      if (startImmediately === true && immediatelyCalled.current === false) {
        onTick();
        immediatelyCalled.current = true;
      }

      return handleClearInterval;
    }
  }, [ms, when, startImmediately, handleClearInterval, onTick]);

  return handleClearInterval;
}

export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

export function useIsFirstRender() {
  const renderRef = useRef(true);

  if (renderRef.current === true) {
    renderRef.current = false;
    return true;
  }

  return renderRef.current;
}

export function useKeyPress(key=" ", cb=() => {}, options = {}) {
  const { event = "keydown", target = window ?? null, eventOptions } = options;

  const onListen = useCallback((target, event) => {
    const handler = (event) => {
      if (event.key === key) {
        cb(event);
        console.log('key pressed', event.key);
      }
    };

    target.addEventListener(event, handler, eventOptions);

    return () => {
      target.removeEventListener(event, handler, eventOptions);
    };
  }, [key, cb, eventOptions]);

  useEffect(() => {
    return onListen(target, event);
  }, [target, event, onListen]);
}

export function useList(defaultList = []) {
  const [list, setList] = useState(defaultList);

  const set = useCallback((l) => {
    setList(l);
  }, []);

  const push = useCallback((element) => {
    setList((l) => [...l, element]);
  }, []);

  const removeAt = useCallback((index) => {
    setList((l) => [...l.slice(0, index), ...l.slice(index + 1)]);
  }, []);

  const insertAt = useCallback((index, element) => {
    setList((l) => [...l.slice(0, index), element, ...l.slice(index)]);
  }, []);

  const updateAt = useCallback((index, element) => {
    setList((l) => l.map((e, i) => (i === index ? element : e)));
  }, []);

  const clear = useCallback(() => setList([]), []);

  return [list, { set, push, removeAt, insertAt, updateAt, clear }];
}

export function useLogger(name, ...rest) {
  const initialRenderRef = useRef(true);

  const handleLog = useCallback((event) => {
    console.log(`${name} ${event}:`, rest);
  }, [name, rest]);

  useEffect(() => {
    if (initialRenderRef.current === false) {
      handleLog("updated");
    }
  });

  useEffect(() => {
    handleLog("mounted");
    initialRenderRef.current = false;

    return () => {
      handleLog("unmounted");
      initialRenderRef.current = true;
    };
  }, [handleLog]);
}

const setLocalStorageItem = (key, value) => {
  const stringifiedValue = JSON.stringify(value);
  window.localStorage.setItem(key, stringifiedValue);
  dispatchStorageEvent(key, stringifiedValue);
};

const removeLocalStorageItem = (key) => {
  window.localStorage.removeItem(key);
  dispatchStorageEvent(key, null);
};

const getLocalStorageItem = (key) => {
  return window.localStorage.getItem(key);
};

const useLocalStorageSubscribe = (callback) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getLocalStorageServerSnapshot = () => {
  throw Error("useLocalStorage is a client-only hook");
};

export function useLocalStorage(key, initialValue) {
  const getSnapshot = () => getLocalStorageItem(key);

  const store = useSyncExternalStore(
    useLocalStorageSubscribe,
    getSnapshot,
    getLocalStorageServerSnapshot
  );

  const setState = useCallback((v) => {
      try {
        const nextState = typeof v === "function" ? v(JSON.parse(store)) : v;

        if (nextState === undefined || nextState === null) {
          removeLocalStorageItem(key);
        } else {
          setLocalStorageItem(key, nextState);
        }
      } catch (e) {
        console.warn(e);
      }
    },[key, store]);

  useEffect(() => {
    if (
      getLocalStorageItem(key) === null &&
      typeof initialValue !== "undefined"
    ) {
      setLocalStorageItem(key, initialValue);
    }
  }, [key, initialValue]);

  return [store ? JSON.parse(store) : initialValue, setState];
}

export function useLockBodyScroll() {
  useLayoutEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
}

export function useLongPress(callback, options = {}) {
  const { threshold = 400, onStart, onFinish, onCancel } = options;
  const isLongPressActive = useRef(false);
  const isPressed = useRef(false);
  const timerId = useRef();

  return useMemo(() => {
    if (typeof callback !== "function") {
      return {};
    }

    const start = (event) => {
      if (!isMouseEvent(event) && !isTouchEvent(event)) return;

      if (onStart) {
        onStart(event);
      }

      isPressed.current = true;
      timerId.current = setTimeout(() => {
        callback(event);
        isLongPressActive.current = true;
      }, threshold);
    };

    const cancel = (event) => {
      if (!isMouseEvent(event) && !isTouchEvent(event)) return;

      if (isLongPressActive.current) {
        if (onFinish) {
          onFinish(event);
        }
      } else if (isPressed.current) {
        if (onCancel) {
          onCancel(event);
        }
      }

      isLongPressActive.current = false;
      isPressed.current = false;

      if (timerId.current) {
        window.clearTimeout(timerId.current);
      }
    };

    const mouseHandlers = {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
    };

    const touchHandlers = {
      onTouchStart: start,
      onTouchEnd: cancel,
    };

    return {
      ...mouseHandlers,
      ...touchHandlers,
    };
  }, [callback, threshold, onCancel, onFinish, onStart]);
}

export function useMap(initialState) {
  const mapRef = useRef(new Map(initialState));
  const [, reRender] = useReducer((x) => x + 1, 0);

  mapRef.current.set = (...args) => {
    Map.prototype.set.apply(mapRef.current, args);
    reRender();
    return mapRef.current;
  };

  mapRef.current.clear = (...args) => {
    Map.prototype.clear.apply(mapRef.current, args);
    reRender();
  };

  mapRef.current.delete = (...args) => {
    const res = Map.prototype.delete.apply(mapRef.current, args);
    reRender();

    return res;
  };

  return mapRef.current;
}

export function useMeasure() {
  const [dimensions, setDimensions] = useState({
    width: null,
    height: null,
  });

  const previousObserver = useRef(null);

  const customRef = useCallback((node) => {
    if (previousObserver.current) {
      previousObserver.current.disconnect();
      previousObserver.current = null;
    }

    if (node?.nodeType === Node.ELEMENT_NODE) {
      const observer = new ResizeObserver(([entry]) => {
        if (entry && entry.borderBoxSize) {
          const { inlineSize: width, blockSize: height } =
            entry.borderBoxSize[0];

          setDimensions({ width, height });
        }
      });

      observer.observe(node);
      previousObserver.current = observer;
    }
  }, []);

  return [customRef, dimensions];
}

export function useMediaQuery(query) {
  const subscribe = useCallback((callback) => {
      const matchMedia = window.matchMedia(query);

      matchMedia.addEventListener("change", callback);
      return () => {
        matchMedia.removeEventListener("change", callback);
      };
    },
    [query]
  );

  const getSnapshot = () => {
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => {
    throw Error("useMediaQuery is a client-only hook");
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useMouse() {
  const [state, setState] = useState({
    x: 0,
    y: 0,
    elementX: 0,
    elementY: 0,
    elementPositionX: 0,
    elementPositionY: 0,
  });

  const ref = useRef(null);

  useLayoutEffect(() => {
    const handleMouseMove = (event) => {
      let newState = {
        x: event.pageX,
        y: event.pageY,
      };

      if (ref.current?.nodeType === Node.ELEMENT_NODE) {
        const { left, top } = ref.current.getBoundingClientRect();
        const elementPositionX = left + window.scrollX;
        const elementPositionY = top + window.scrollY;
        const elementX = event.pageX - elementPositionX;
        const elementY = event.pageY - elementPositionY;

        newState.elementX = elementX;
        newState.elementY = elementY;
        newState.elementPositionX = elementPositionX;
        newState.elementPositionY = elementPositionY;
      }

      setState((s) => {
        return {
          ...s,
          ...newState,
        };
      });
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return [state, ref];
}

const getConnection = () => {
  return (
    navigator?.connection ||
    navigator?.mozConnection ||
    navigator?.webkitConnection
  );
};

const useNetworkStateSubscribe = (callback) => {
  window.addEventListener("online", callback, { passive: true });
  window.addEventListener("offline", callback, { passive: true });

  const connection = getConnection();

  if (connection) {
    connection.addEventListener("change", callback, { passive: true });
  }

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);

    if (connection) {
      connection.removeEventListener("change", callback);
    }
  };
};

const getNetworkStateServerSnapshot = () => {
  throw Error("useNetworkState is a client-only hook");
};

export function useNetworkState() {
  const cache = useRef({});

  const getSnapshot = () => {
    const online = navigator.onLine;
    const connection = getConnection();

    const nextState = {
      online,
      downlink: connection?.downlink,
      downlinkMax: connection?.downlinkMax,
      effectiveType: connection?.effectiveType,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      type: connection?.type,
    };

    if (isShallowEqual(cache.current, nextState)) {
      return cache.current;
    } else {
      cache.current = nextState;
      return nextState;
    }
  };

  return useSyncExternalStore(
    useNetworkStateSubscribe,
    getSnapshot,
    getNetworkStateServerSnapshot
  );
}

export function useObjectState(initialValue) {
  const [state, setState] = useState(initialValue);

  const handleUpdate = useCallback((arg) => {
    if (typeof arg === "function") {
      setState((s) => {
        const newState = arg(s);

        if (isPlainObject(newState)) {
          return {
            ...s,
            ...newState,
          };
        }
      });
    }

    if (isPlainObject(arg)) {
      setState((s) => ({
        ...s,
        ...arg,
      }));
    }
  }, []);

  return [state, handleUpdate];
}

export function useOrientation() {
  const [orientation, setOrientation] = useState({
    angle: 0,
    type: "landscape-primary",
  });

  useLayoutEffect(() => {
    const handleChange = () => {
      const { angle, type } = window.screen.orientation;
      setOrientation({
        angle,
        type,
      });
    };

    const handle_orientationchange = () => {
      setOrientation({
        type: "UNKNOWN",
        angle: window.orientation,
      });
    };

    if (window.screen?.orientation) {
      handleChange();
      window.screen.orientation.addEventListener("change", handleChange);
    } else {
      handle_orientationchange();
      window.addEventListener("orientationchange", handle_orientationchange);
    }

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", handleChange);
      } else {
        window.removeEventListener(
          "orientationchange",
          handle_orientationchange
        );
      }
    };
  }, []);

  return orientation;
}

export function usePageLeave(cb) {
  const onLeave = useCallback((event) => {
    const from = event.relatedTarget || event.toElement;
    if (!from || from.nodeName === "HTML") {
      cb();
    }
  }, [cb]);

  useEffect(() => {
    document.addEventListener("mouseout", onLeave);

    return () => {
      document.removeEventListener("mouseout", onLeave);
    };
  }, [onLeave]);
}

const usePreferredLanguageSubscribe = (cb) => {
  window.addEventListener("languagechange", cb);
  return () => window.removeEventListener("languagechange", cb);
};

const getPreferredLanguageSnapshot = () => {
  return navigator.language;
};

const getPreferredLanguageServerSnapshot = () => {
  throw Error("usePreferredLanguage is a client-only hook");
};

export function usePreferredLanguage() {
  return useSyncExternalStore(
    usePreferredLanguageSubscribe,
    getPreferredLanguageSnapshot,
    getPreferredLanguageServerSnapshot
  );
}

export function usePrevious(value) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(null);

  if (value !== current) {
    setPrevious(current);
    setCurrent(value);
  }

  return previous;
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function useRandomInterval(cb, { minDelay, maxDelay }) {
  const timeoutId = useRef(null);
  const onInterval = useCallback(() => {
    cb();
  }, [cb]);

  const handleClearTimeout = useCallback(() => {
    window.clearTimeout(timeoutId.current);
  }, []);

  useEffect(() => {
    const tick = () => {
      const interval = getRandomNumber(minDelay, maxDelay);
      timeoutId.current = window.setTimeout(() => {
        onInterval();
        tick();
      }, interval);
    };

    tick();

    return handleClearTimeout;
  }, [minDelay, maxDelay, handleClearTimeout, onInterval]);

  return handleClearTimeout;
}

export function useQueue(initialValue = []) {
  const [queue, setQueue] = useState(initialValue);

  const add = useCallback((element) => {
    setQueue((q) => [...q, element]);
  }, []);

  const remove = useCallback(() => {
    let removedElement;

    setQueue(([first, ...q]) => {
      removedElement = first;
      return q;
    });

    return removedElement;
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    add,
    remove,
    clear,
    first: queue[0],
    last: queue[queue.length - 1],
    size: queue.length,
    queue,
  };
}

export function useRenderCount() {
  const count = useRef(0);

  count.current++;

  return count.current;
}

export function useRenderInfo(name = "Unknown") {
  const count = useRef(0);
  const lastRender = useRef();
  const now = Date.now();

  count.current++;

  useEffect(() => {
    lastRender.current = Date.now();
  });

  const sinceLastRender = lastRender.current ? now - lastRender.current : 0;

  if (process.env.NODE_ENV !== "production") {
    const info = {
      name,
      renders: count.current,
      sinceLastRender,
      timestamp: now,
    };
    // console.log(info);
    return info;
  }
}

export function useScript(src, options = {}) {
  const [status, setStatus] = useState("loading");
  const optionsRef = useRef(options);

  useEffect(() => {
    let script = document.querySelector(`script[src="${src}"]`);

    const domStatus = script?.getAttribute("data-status");
    if (domStatus) {
      setStatus(domStatus);
      return;
    }

    if (script === null) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.setAttribute("data-status", "loading");
      document.body.appendChild(script);

      const handleScriptLoad = () => {
        script.setAttribute("data-status", "ready");
        setStatus("ready");
        removeEventListeners();
      };

      const handleScriptError = () => {
        script.setAttribute("data-status", "error");
        setStatus("error");
        removeEventListeners();
      };

      const removeEventListeners = () => {
        script.removeEventListener("load", handleScriptLoad);
        script.removeEventListener("error", handleScriptError);
      };

      script.addEventListener("load", handleScriptLoad);
      script.addEventListener("error", handleScriptError);

      const removeOnUnmount = optionsRef.current.removeOnUnmount;

      return () => {
        if (removeOnUnmount === true) {
          script.remove();
          removeEventListeners();
        }
      };
    } else {
      setStatus("unknown");
    }
  }, [src]);

  return status;
}

const setSessionStorageItem = (key, value) => {
  const stringifiedValue = JSON.stringify(value);
  window.sessionStorage.setItem(key, stringifiedValue);
  dispatchStorageEvent(key, stringifiedValue);
};

const removeSessionStorageItem = (key) => {
  window.sessionStorage.removeItem(key);
  dispatchStorageEvent(key, null);
};

const getSessionStorageItem = (key) => {
  return window.sessionStorage.getItem(key);
};

const useSessionStorageSubscribe = (callback) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getSessionStorageServerSnapshot = () => {
  throw Error("useSessionStorage is a client-only hook");
};

export function useSessionStorage(key, initialValue) {
  const getSnapshot = () => getSessionStorageItem(key);

  const store = useSyncExternalStore(
    useSessionStorageSubscribe,
    getSnapshot,
    getSessionStorageServerSnapshot
  );

  const setState = useCallback((v) => {
      try {
        const nextState = typeof v === "function" ? v(JSON.parse(store)) : v;

        if (nextState === undefined || nextState === null) {
          removeSessionStorageItem(key);
        } else {
          setSessionStorageItem(key, nextState);
        }
      } catch (e) {
        console.warn(e);
      }
    },[key, store]);

  useEffect(() => {
    if (getSessionStorageItem(key) === null && typeof initialValue !== "undefined" ) {
      setSessionStorageItem(key, initialValue);
    }
  }, [key, initialValue]);

  return [store ? JSON.parse(store) : initialValue, setState];
}

export function useSet(values) {
  const setRef = useRef(new Set(values));
  const [, reRender] = useReducer((x) => x + 1, 0);

  setRef.current.add = (...args) => {
    const res = Set.prototype.add.apply(setRef.current, args);
    reRender();

    return res;
  };

  setRef.current.clear = (...args) => {
    Set.prototype.clear.apply(setRef.current, args);
    reRender();
  };

  setRef.current.delete = (...args) => {
    const res = Set.prototype.delete.apply(setRef.current, args);
    reRender();

    return res;
  };

  return setRef.current;
}

export function useThrottle(value, interval = 500) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(null);

  useEffect(() => {
    const now = Date.now();

    if (lastUpdated.current && now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const id = window.setTimeout(() => {
        lastUpdated.current = now;
        setThrottledValue(value);
      }, interval);

      return () => window.clearTimeout(id);
    }
  }, [value, interval]);

  return throttledValue;
}

export function useTimeout(cb, ms) {
  const id = useRef(null);
  const onTimeout = useCallback(() => {
    cb();
    id.current = null;
  }, [cb]);

  const handleClearTimeout = useCallback(() => {
    window.clearTimeout(id.current);
  }, []);

  useEffect(() => {
    id.current = window.setTimeout(onTimeout, ms);

    return handleClearTimeout;
  }, [ms, handleClearTimeout, onTimeout]);

  return handleClearTimeout;
}

export function useToggle(initialValue) {
  const [on, setOn] = useState(() => {
    if (typeof initialValue === "boolean") {
      return initialValue;
    }

    return Boolean(initialValue);
  });

  const handleToggle = useCallback((value) => {
    if (typeof value === "boolean") {
      return setOn(value);
    }

    return setOn((v) => !v);
  }, []);

  return [on, handleToggle];
}

const useVisibilityChangeSubscribe = (callback) => {
  document.addEventListener("visibilitychange", callback);

  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
};

const getVisibilityChangeSnapshot = () => {
  return document.visibilityState;
};

const getVisibilityChangeServerSnapshot = () => {
  throw Error("useVisibilityChange is a client-only hook");
};

export function useVisibilityChange() {
  const visibilityState = useSyncExternalStore(
    useVisibilityChangeSubscribe,
    getVisibilityChangeSnapshot,
    getVisibilityChangeServerSnapshot
  );

  return visibilityState === "visible";
}

export function useWindowScroll() {
  const [state, setState] = useState({
    x: null,
    y: null,
  });

  const scrollTo = useCallback((...args) => {
    if (typeof args[0] === "object") {
      window.scrollTo(args[0]);
    } else if (typeof args[0] === "number" && typeof args[1] === "number") {
      window.scrollTo(args[0], args[1]);
    } else {
      throw new Error(
        `Invalid arguments passed to scrollTo. See here for more info. https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo`
      );
    }
  }, []);

  useLayoutEffect(() => {
    const handleScroll = () => {
      setState({ x: window.scrollX, y: window.scrollY });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return [state, scrollTo];
}

export function useWindowSize() {
  const [size, setSize] = useState({
    width: null,
    height: null,
  });

  useLayoutEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return size;
}
