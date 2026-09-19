import React, { useState, useEffect } from 'react';
import { View } from '@tarojs/components';
import { VChart } from '../../../src/';
// import { VChartSimple as VChart } from '../../../src/simple';
import { VChart as chartConstructor, initVChart } from './vchart';

import Taro from '@tarojs/taro';

export default function (props: any) {
  console.log('env', Taro.getEnv());
  initVChart();
  // let type;
  // if (URLSearchParams) {
  //   const url = new URLSearchParams(props.tid);
  //   const type = url.get('pages/chart/index?type');
  // }

  // if (!type) {
  //   // h5 下解析不出来，所以用了这个本方法，不重要，跑通就行
  //   type = props.tid.substring(props.tid.indexOf('type=') + 5, props.tid.indexOf('&'));
  // }
  const type = props.tid.substring(props.tid.indexOf('type=') + 5, props.tid.indexOf('&'));
  console.log(type);

  const specData = require(`../../data/${type}`).default;

  const [spec, setSpec] = useState(specData);

  useEffect(() => {
    setTimeout(() => {
      setSpec({
        ...spec
        // theme: {},
      });
    }, 5000);
  }, []);

  return (
    <View>
      <View
        style={{
          boxSizing: 'border-box',
          width: '100vw',
          height: '75vh',
          padding: '0 8px'
        }}
      >
        <VChart
          type={Taro.getEnv()}
          spec={spec}
          chartConstructor={chartConstructor}
          canvasId={`${type}chart1`}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '4px',
            border: '1px solid #eeeeee'
          }}
          options={{
            disableDirtyBounds: true
          }}
          onChartInit={() => {
            console.log(`init ${type}`);
          }}
          onChartReady={() => {
            console.log(`ready ${type}`);
          }}
          onChartUpdate={() => {
            console.log(`update ${type}`);
          }}
        />
      </View>
    </View>
  );
}
