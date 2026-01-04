import PropTypes from 'prop-types';

export const PanelShape = {
    panelHeader: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
    panelFooter: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
};

export const PanelShapeDefaults = {};
