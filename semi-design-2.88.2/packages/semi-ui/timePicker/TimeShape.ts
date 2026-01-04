import PropTypes from 'prop-types';

const PlainTimeShape = [PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)];

/**
 * Can be
 * - 12:00:12
 * - \[12:00:12]
 * - \[12:00:12, 12:21:12]
 * - \[[12:00:12, 12:21:12], [12:11:12, 12:32:12]]
 */
const TimeShape = PropTypes.oneOfType([
    ...PlainTimeShape,
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.number),
    PropTypes.arrayOf(PropTypes.instanceOf(Date)),
]);

export { TimeShape };
