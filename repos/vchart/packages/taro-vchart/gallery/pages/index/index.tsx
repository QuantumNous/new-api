import React from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';

export default function Index() {
  const charts = [
    {
      id: 'crosshair',
      name: 'crosshair'
    },
    {
      id: 'scatter',
      name: 'scatter'
    },
    {
      id: 'line',
      name: 'line'
    },
    {
      id: 'area',
      name: 'area'
    },
    {
      id: 'funnel',
      name: 'funnel'
    },
    {
      id: 'bar',
      name: 'bar'
    },
    {
      id: 'horizontal-bar',
      name: 'horizontal-bar'
    },
    {
      id: 'radar',
      name: 'radar'
    },
    {
      id: 'sankey',
      name: 'sankey'
    },
    {
      id: 'pie',
      name: 'pie'
    },
    {
      id: 'ring',
      name: 'ring'
    },
    {
      id: 'rose',
      name: 'rose'
    },
    // {
    //   id: 'map',
    //   name: 'map'
    // },
    {
      id: 'wordcloud',
      name: 'wordcloud'
    },
    {
      id: 'boxplot',
      name: 'boxplot'
    },
    {
      id: 'dual-axis',
      name: 'dual-axis'
    }
  ];

  return (
    <View
      style={{
        color: '#424e66',
        margin: '10px 0',
        fontSize: '15px',
        display: 'flex',
        flexWrap: 'wrap'
      }}
    >
      <View
        style={{
          display: 'flex',
          flexWrap: 'wrap'
        }}
      >
        {charts.map(d => (
          <View
            key={d.id}
            style={{
              width: '20%',
              height: '60px',
              background: 'rgba(0,0,0,0.1)',
              padding: '0 8px',
              boxSizing: 'border-box',
              margin: '10px 2.5%',
              display: 'flex',
              alignItems: 'center',
              wordBreak: 'break-all',
              justifyContent: 'center'
            }}
            onClick={() => {
              Taro.navigateTo({
                url: `/pages/chart/index?type=${d.id}`
              });
            }}
          >
            <Text>{d.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
