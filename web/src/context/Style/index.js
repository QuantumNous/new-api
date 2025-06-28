// contexts/Style/index.js

import React, { useReducer, useEffect, useMemo, createContext } from 'react';
import { useLocation } from 'react-router-dom';
import { isMobile as getIsMobile } from '../../helpers';

// Action Types
const ACTION_TYPES = {
  TOGGLE_SIDER: 'TOGGLE_SIDER',
  SET_SIDER: 'SET_SIDER',
  SET_MOBILE: 'SET_MOBILE',
  SET_SIDER_COLLAPSED: 'SET_SIDER_COLLAPSED',
  BATCH_UPDATE: 'BATCH_UPDATE',
};

// Constants
const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: 'default_collapse_sidebar',
};

const ROUTE_PATTERNS = {
  CONSOLE: '/console',
};

/**
 * 判断路径是否为控制台路由
 * @param {string} pathname - 路由路径
 * @returns {boolean} 是否为控制台路由
 */
const isConsoleRoute = (pathname) => {
  return pathname === ROUTE_PATTERNS.CONSOLE ||
    pathname.startsWith(ROUTE_PATTERNS.CONSOLE + '/');
};

/**
 * 获取初始状态
 * @param {string} pathname - 当前路由路径
 * @returns {Object} 初始状态对象
 */
const getInitialState = (pathname) => {
  const isMobile = getIsMobile();
  const isConsole = isConsoleRoute(pathname);
  const isCollapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';

  return {
    isMobile,
    showSider: isConsole && !isMobile,
    siderCollapsed: isCollapsed,
    isManualSiderControl: false,
  };
};

/**
 * Style reducer
 * @param {Object} state - 当前状态
 * @param {Object} action - action 对象
 * @returns {Object} 新状态
 */
const styleReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.TOGGLE_SIDER:
      return {
        ...state,
        showSider: !state.showSider,
        isManualSiderControl: true,
      };

    case ACTION_TYPES.SET_SIDER:
      return {
        ...state,
        showSider: action.payload,
        isManualSiderControl: action.isManualControl ?? false,
      };

    case ACTION_TYPES.SET_MOBILE:
      return {
        ...state,
        isMobile: action.payload,
      };

    case ACTION_TYPES.SET_SIDER_COLLAPSED:
      // 自动保存到 localStorage
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, action.payload.toString());
      return {
        ...state,
        siderCollapsed: action.payload,
      };

    case ACTION_TYPES.BATCH_UPDATE:
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
};

// Context (内部使用，不导出)
const StyleContext = createContext(null);

/**
 * 自定义 Hook - 处理窗口大小变化
 * @param {Function} dispatch - dispatch 函数
 * @param {Object} state - 当前状态
 * @param {string} pathname - 当前路径
 */
const useWindowResize = (dispatch, state, pathname) => {
  useEffect(() => {
    const handleResize = () => {
      const isMobile = getIsMobile();
      dispatch({ type: ACTION_TYPES.SET_MOBILE, payload: isMobile });

      // 只有在非手动控制的情况下，才根据屏幕大小自动调整侧边栏
      if (!state.isManualSiderControl && isConsoleRoute(pathname)) {
        dispatch({
          type: ACTION_TYPES.SET_SIDER,
          payload: !isMobile,
          isManualControl: false
        });
      }
    };

    let timeoutId;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [dispatch, state.isManualSiderControl, pathname]);
};

/**
 * 自定义 Hook - 处理路由变化
 * @param {Function} dispatch - dispatch 函数
 * @param {string} pathname - 当前路径
 */
const useRouteChange = (dispatch, pathname) => {
  useEffect(() => {
    const isMobile = getIsMobile();
    const isConsole = isConsoleRoute(pathname);

    dispatch({
      type: ACTION_TYPES.BATCH_UPDATE,
      payload: {
        showSider: isConsole && !isMobile,
        isManualSiderControl: false,
      },
    });
  }, [pathname, dispatch]);
};

/**
 * 自定义 Hook - 处理移动设备侧边栏自动收起
 * @param {Object} state - 当前状态
 * @param {Function} dispatch - dispatch 函数
 */
const useMobileSiderAutoHide = (state, dispatch) => {
  useEffect(() => {
    // 移动设备上，如果不是手动控制且侧边栏是打开的，则自动关闭
    if (state.isMobile && state.showSider && !state.isManualSiderControl) {
      dispatch({ type: ACTION_TYPES.SET_SIDER, payload: false });
    }
  }, [state.isMobile, state.showSider, state.isManualSiderControl, dispatch]);
};

/**
 * Style Provider 组件
 */
export const StyleProvider = ({ children }) => {
  const location = useLocation();
  const pathname = location.pathname;

  const [state, dispatch] = useReducer(
    styleReducer,
    pathname,
    getInitialState
  );

  useWindowResize(dispatch, state, pathname);
  useRouteChange(dispatch, pathname);
  useMobileSiderAutoHide(state, dispatch);

  const contextValue = useMemo(
    () => ({ state, dispatch }),
    [state]
  );

  return (
    <StyleContext.Provider value={contextValue}>
      {children}
    </StyleContext.Provider>
  );
};

/**
 * 自定义 Hook - 使用 StyleContext
 * @returns {{state: Object, dispatch: Function}} context value
 */
export const useStyle = () => {
  const context = React.useContext(StyleContext);
  if (!context) {
    throw new Error('useStyle must be used within StyleProvider');
  }
  return context;
};

// 导出 action creators 以便外部使用
export const styleActions = {
  toggleSider: () => ({ type: ACTION_TYPES.TOGGLE_SIDER }),
  setSider: (show, isManualControl = false) => ({
    type: ACTION_TYPES.SET_SIDER,
    payload: show,
    isManualControl
  }),
  setMobile: (isMobile) => ({ type: ACTION_TYPES.SET_MOBILE, payload: isMobile }),
  setSiderCollapsed: (collapsed) => ({
    type: ACTION_TYPES.SET_SIDER_COLLAPSED,
    payload: collapsed
  }),
};
