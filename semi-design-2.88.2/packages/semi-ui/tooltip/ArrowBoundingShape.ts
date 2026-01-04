import PropTypes from 'prop-types';

export default PropTypes.shape({
    offsetX: PropTypes.number,
    offsetY: PropTypes.number,
    width: PropTypes.number, // This value is swapped with height when position is leftXXX or rightXXX
    height: PropTypes.number,
});
