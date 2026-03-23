import React from 'react';
import ModelPricingEditor from './components/ModelPricingEditor';

export default function ModelSettingsVisualEditor(props) {
  return <ModelPricingEditor options={props.options} refresh={props.refresh} />;
}
