/* eslint-disable react/jsx-props-no-spreading */
import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import merge from 'deepmerge';
import hoistNonReactStatic from 'hoist-non-react-statics';

import dispatchTrackingEvent from './dispatchTrackingEvent';

export const TrackingContextType = PropTypes.shape({
  data: PropTypes.object,
  dispatch: PropTypes.func,
  process: PropTypes.func,
});

export const ReactTrackingContext = React.createContext({});

export default function withTrackingComponentDecorator(
  trackingData = {},
  { dispatch = dispatchTrackingEvent, dispatchOnMount = false, process } = {}
) {
  return DecoratedComponent => {
    const decoratedComponentName =
      DecoratedComponent.displayName || DecoratedComponent.name || 'Component';

    function WithTracking(props) {
      const tracking = useContext(ReactTrackingContext);

      const getProcessFn = useCallback(() => tracking && tracking.process, []);

      const getOwnTrackingData = useCallback(() => {
        const ownTrackingData =
          typeof trackingData === 'function'
            ? trackingData(props)
            : trackingData;
        return ownTrackingData || {};
      }, [trackingData, props]);

      const getTrackingDataFn = useCallback(() => {
        const contextGetTrackingData =
          (tracking && tracking.getTrackingData) || getOwnTrackingData;

        return () =>
          contextGetTrackingData === getOwnTrackingData
            ? getOwnTrackingData()
            : merge(contextGetTrackingData(), getOwnTrackingData());
      }, [getOwnTrackingData]);

      const getTrackingDispatcher = useCallback(() => {
        const contextDispatch = (tracking && tracking.dispatch) || dispatch;
        return data => contextDispatch(merge(getOwnTrackingData(), data || {}));
      }, [dispatch, getOwnTrackingData]);

      const trackEvent = useCallback(
        (data = {}) => {
          getTrackingDispatcher()(data);
        },
        [getTrackingDispatcher]
      );

      useEffect(() => {
        const contextProcess = getProcessFn();
        const getTrackingData = getTrackingDataFn();

        if (getProcessFn() && process) {
          // eslint-disable-next-line
          console.error(
            '[react-tracking] options.process should be defined once on a top-level component'
          );
        }

        if (
          typeof contextProcess === 'function' &&
          typeof dispatchOnMount === 'function'
        ) {
          trackEvent(
            merge(
              contextProcess(getOwnTrackingData()) || {},
              dispatchOnMount(getTrackingData()) || {}
            )
          );
        } else if (typeof contextProcess === 'function') {
          const processed = contextProcess(getOwnTrackingData());
          if (processed || dispatchOnMount === true) {
            trackEvent(processed);
          }
        } else if (typeof dispatchOnMount === 'function') {
          trackEvent(dispatchOnMount(getTrackingData()));
        } else if (dispatchOnMount === true) {
          trackEvent();
        }
      }, []);

      const trackingProp = useMemo(
        () => ({
          trackEvent,
          getTrackingData: getTrackingDataFn(),
        }),
        [trackEvent, getTrackingDataFn]
      );

      const contextValue = useMemo(
        () => ({
          dispatch: getTrackingDispatcher(),
          getTrackingData: getTrackingDataFn(),
          process: getProcessFn() || process,
        }),
        [getTrackingDispatcher, getTrackingDataFn, getProcessFn, process]
      );

      return useMemo(
        () => (
          <ReactTrackingContext.Provider value={contextValue}>
            <DecoratedComponent {...props} tracking={trackingProp} />
          </ReactTrackingContext.Provider>
        ),
        [contextValue, trackingProp]
      );
    }

    WithTracking.displayName = `WithTracking(${decoratedComponentName})`;

    hoistNonReactStatic(WithTracking, DecoratedComponent);

    return WithTracking;
  };
}
