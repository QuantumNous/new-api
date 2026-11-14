import React, { useState, useCallback, useEffect } from 'react';
import './index.scss';
import { Avatar, Input, Divider, Button, InputNumber, Upload, Message, Select } from '@arco-design/web-react';
import {
  acceptRatioData,
  carSaleMockData,
  carSalesDataEng,
  mallSalesData,
  mockUserInput10,
  mockUserInput2,
  mockUserInput3,
  mockUserInput3Eng,
  mockUserInput6,
  mockUserInput6Eng,
  mockUserInput8
} from '../constants';
import VMind, { Model } from '@visactor/vmind';
const Option = Select.Option;
const TextArea = Input.TextArea;
type IPropsType = {
  openAIKey: string | undefined;
  setOpenAIKey: any;
  onSpecGenerate: (
    spec: any,
    time: {
      totalTime: number;
      frameArr: any[];
    }
  ) => void;
};

const demoDataList: { [key: string]: any } = {
  'Electric vehicle sales': carSalesDataEng,
  'College entrance examination': acceptRatioData,
  'Shopping Mall Sales Performance': mallSalesData,
  'Global GDP': mockUserInput6Eng,
  'Sales of different drinkings': mockUserInput3Eng
};

export function LeftInput(props: IPropsType) {
  const defaultDataKey = Object.keys(demoDataList)[0];
  const { openAIKey, setOpenAIKey } = props;
  const [describe, setDescribe] = useState<string>(demoDataList[defaultDataKey].input);
  const [csv, setCsv] = useState<string>(demoDataList[defaultDataKey].csv);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDataName, setSelectedDataName] = useState<string>(defaultDataKey);

  const askGPT = useCallback(async () => {
    setLoading(true);
    if (!openAIKey) {
      Message.warning('Please input your openAI api key!');
      return;
    }
    const vmind = new VMind({
      model: Model.GPT3_5, //目前支持 gpt-3.5, gpt-4, skylark pro 模型。在后续的图表生成中将调用指定的模型
      headers: {
        Authorization: `Bearer ${openAIKey}`
      } //headers 将会被直接用作大模型请求中的 request header. 可以将模型 api key 放入 header 中
    });
    //传入 csv 字符串，获得 fieldInfo 和 dataset 用于图表生成
    const { fieldInfo, dataset } = vmind.parseCSVData(csv);
    //传入 csv 字符串，和用户的展示意图，调用大模型，获得 fieldInfo 和 dataset 用于图表生成。NOTE：这将会把明数据传给大模型
    //const { fieldInfo, dataset } = await vmind.parseCSVDataWithLLM(csv, userInput);
    //调用图表生成接口，获得 spec 和图表动画时长
    const { spec, time } = await vmind.generateChart(describe, fieldInfo, dataset);
    props.onSpecGenerate(spec, time);
    setLoading(false);
  }, [describe, csv, openAIKey]);

  return (
    <div className="left-sider">
      <div
        style={{
          marginTop: 20,
          width: '80%',
          marginBottom: 10
        }}
      >
        <div
          style={{
            marginBottom: 10
          }}
        >
          <span>Demo Data:</span>
        </div>
        <Select
          style={{
            width: '100%'
          }}
          value={selectedDataName}
          onChange={v => {
            setSelectedDataName(v);
            const dataObj = demoDataList[v];
            setDescribe(dataObj.input);
            setCsv(dataObj.csv);
          }}
        >
          {Object.keys(demoDataList).map(name => (
            <Option key={name} value={name}>
              {name}
            </Option>
          ))}
        </Select>
      </div>
      <div
        style={{
          marginLeft: 5,
          marginBottom: 20,
          width: '80%'
        }}
      >
        <p>
          <Avatar size={18}>1</Avatar>
          <span
            style={{
              marginLeft: 10
            }}
          >
            Input your openAI api key:
          </span>
        </p>
        <Input value={openAIKey} onChange={v => setOpenAIKey(v)} style={{ width: '100%' }} />
      </div>

      <div
        style={{
          marginLeft: 10,
          marginBottom: 20,
          width: '80%'
        }}
      >
        <p>
          <Avatar size={18}>2</Avatar>
          <span style={{ marginLeft: 10 }}>What would you like to visualize?</span>
        </p>

        <TextArea value={describe} onChange={v => setDescribe(v)} style={{ minHeight: 160 }} />
      </div>

      <div
        style={{
          marginLeft: 10,
          marginBottom: 20,
          width: '80%'
        }}
      >
        <p>
          <Avatar size={18}>3</Avatar>
          <span style={{ marginLeft: 10 }}>Input your data file in csv format</span>
        </p>
        <TextArea value={csv} onChange={v => setCsv(v)} style={{ minHeight: 300 }} />
      </div>

      <Divider style={{ marginTop: 20 }} />

      <div className="generate-botton">
        <Button
          loading={loading}
          onClick={() => {
            askGPT();
          }}
          disabled={!openAIKey}
          shape="round"
          //type="primary"
        >
          generate chart (preview)
        </Button>
      </div>
    </div>
  );
}
