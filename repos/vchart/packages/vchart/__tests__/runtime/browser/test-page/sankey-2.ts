import { STATE_HOVER_REVERSE } from '../../../../cjs/compile/mark/interface';
import { isMobile } from 'react-device-detect';
import type { ILayoutSpec, ISankeyChartSpec } from '../../../../src/index';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const data = [
    {
      id: 'sankeyData',
      name: 'sankey',
      values: [
        {
          nodes: [
            {
              name: 'a11989.b310713.c0.d0',
              value: 8054,
              position: 'end_1',
              children: [
                {
                  name: 'end_2#a11989.b310713.c0.d0',
                  value: 4238,
                  position: 'end_2#0',
                  children: [],
                  btm: {
                    start: '',
                    end: 'a11989.b310713.c0.d0',
                    step: {
                      index: 2,
                      name: 'a11989.b310713.c0.d0',
                      label: '站点一.事件分析',
                      image_url:
                        'https://data.bytedance.net/byteio/api/v1/file/images/image_59cd32a2-3072-49b5-96e8-4766066f8bdc.jpeg',
                      page_label: '事件分析',
                      site_id: '112853',
                      type: 1
                    },
                    pre_steps: [
                      {
                        index: 1,
                        name: 'a11989.b310713.c0.d0'
                      }
                    ]
                  },
                  btm_data_list: [
                    {
                      uv: 4238,
                      pv: 10047,
                      avg: 639244.0986364089,
                      pct50: 114307
                    }
                  ],
                  btm_key: 'a11989.b310713.c0.d0',
                  pre_btm_data_list: [
                    {
                      uv: 8054,
                      pv: 32055,
                      avg: 74015.07100296365,
                      pct50: 0
                    }
                  ],
                  hasChild: false
                },
                {
                  name: 'end_2#a11989.b596405.c0.d0',
                  value: 3357,
                  position: 'end_2#1',
                  children: [],
                  btm: {
                    start: '',
                    end: 'a11989.b310713.c0.d0',
                    step: {
                      index: 2,
                      name: 'a11989.b596405.c0.d0',
                      label: '站点一.看板',
                      image_url:
                        'https://data.bytedance.net/byteio/api/v1/file/images/image_c6295d90-498f-46a9-9340-c8c173fce48f.jpeg',
                      page_label: '看板',
                      site_id: '112853',
                      type: 1
                    },
                    pre_steps: [
                      {
                        index: 1,
                        name: 'a11989.b310713.c0.d0'
                      }
                    ]
                  },
                  btm_data_list: [
                    {
                      uv: 3357,
                      pv: 7527,
                      avg: 215085.0968513352,
                      pct50: 19941
                    }
                  ],
                  btm_key: 'a11989.b596405.c0.d0',
                  pre_btm_data_list: [
                    {
                      uv: 8054,
                      pv: 32055,
                      avg: 74015.07100296365,
                      pct50: 0
                    }
                  ],
                  hasChild: false
                },
                {
                  name: 'end_2#a11989.b0.c0.d0',
                  value: 572,
                  position: 'end_2#2',
                  children: [],
                  btm: {
                    start: '',
                    end: 'a11989.b310713.c0.d0',
                    step: {
                      index: 2,
                      name: 'a11989.b0.c0.d0',
                      label: '站点一',
                      image_url:
                        'https://data.bytedance.net/byteio/api/v1/file/images/image_4ddc79dd-87db-4e1a-b756-e749e7116c87.jpg',
                      type: 0
                    },
                    pre_steps: [
                      {
                        index: 1,
                        name: 'a11989.b310713.c0.d0'
                      }
                    ]
                  },
                  btm_data_list: [
                    {
                      uv: 572,
                      pv: 762,
                      avg: 232897.343832021,
                      pct50: 39371.5
                    }
                  ],
                  btm_key: 'a11989.b0.c0.d0',
                  pre_btm_data_list: [
                    {
                      uv: 8054,
                      pv: 32055,
                      avg: 74015.07100296365,
                      pct50: 0
                    }
                  ],
                  hasChild: false
                },
                {
                  name: 'end_2#a11989.b09687.c0.d0',
                  value: 330,
                  position: 'end_2#3',
                  children: [],
                  btm: {
                    start: '',
                    end: 'a11989.b310713.c0.d0',
                    step: {
                      index: 2,
                      name: 'a11989.b09687.c0.d0',
                      label: '站点一.指标分析',
                      image_url:
                        'https://data.bytedance.net/byteio/api/v1/file/images/image_6fa08f36-9d38-4eaa-9f99-7df1b1a2d495.jpeg',
                      page_label: '指标分析',
                      site_id: '112853',
                      type: 1
                    },
                    pre_steps: [
                      {
                        index: 1,
                        name: 'a11989.b310713.c0.d0'
                      }
                    ]
                  },
                  btm_data_list: [
                    {
                      uv: 330,
                      pv: 375,
                      avg: 29457.370666666666,
                      pct50: 2480
                    }
                  ],
                  btm_key: 'a11989.b09687.c0.d0',
                  pre_btm_data_list: [
                    {
                      uv: 8054,
                      pv: 32055,
                      avg: 74015.07100296365,
                      pct50: 0
                    }
                  ],
                  hasChild: false
                },
                {
                  name: 'end_2#a11989.b58640.c0.d0',
                  value: 213,
                  position: 'end_2#4',
                  children: [
                    {
                      name: 'end_3#a11989.b310713.c0.d0',
                      value: 63,
                      children: [],
                      btm: {
                        start: '',
                        end: 'a11989.b310713.c0.d0',
                        step: {
                          index: 3,
                          name: 'a11989.b310713.c0.d0',
                          label: '站点一.事件分析',
                          image_url:
                            'https://data.bytedance.net/byteio/api/v1/file/images/image_59cd32a2-3072-49b5-96e8-4766066f8bdc.jpeg',
                          page_label: '事件分析',
                          site_id: '112853',
                          type: 1
                        },
                        pre_steps: [
                          {
                            index: 1,
                            name: 'a11989.b310713.c0.d0'
                          },
                          {
                            index: 2,
                            name: 'a11989.b58640.c0.d0'
                          }
                        ]
                      },
                      btm_data_list: [
                        {
                          uv: 63,
                          pv: 72,
                          avg: 909586.2083333334,
                          pct50: 25735
                        }
                      ],
                      btm_key: 'a11989.b310713.c0.d0',
                      pre_btm_data_list: [
                        {
                          uv: 213,
                          pv: 290,
                          avg: 293909.7344827586,
                          pct50: 60751.5
                        }
                      ],
                      position: 'end_2#4#0'
                    },
                    {
                      name: 'end_3#a11989.b58640.c0.d0',
                      value: 60,
                      children: [],
                      btm: {
                        start: '',
                        end: 'a11989.b310713.c0.d0',
                        step: {
                          index: 3,
                          name: 'a11989.b58640.c0.d0',
                          label: '站点一.转化分析',
                          image_url:
                            'https://data.bytedance.net/byteio/api/v1/file/images/image_8743eb98-81e3-4069-8496-1527e16e7800.jpeg',
                          page_label: '转化分析',
                          site_id: '112853',
                          type: 1
                        },
                        pre_steps: [
                          {
                            index: 1,
                            name: 'a11989.b310713.c0.d0'
                          },
                          {
                            index: 2,
                            name: 'a11989.b58640.c0.d0'
                          }
                        ]
                      },
                      btm_data_list: [
                        {
                          uv: 60,
                          pv: 66,
                          avg: 234147.39393939395,
                          pct50: 29118
                        }
                      ],
                      btm_key: 'a11989.b58640.c0.d0',
                      pre_btm_data_list: [
                        {
                          uv: 213,
                          pv: 290,
                          avg: 293909.7344827586,
                          pct50: 60751.5
                        }
                      ],
                      position: 'end_2#4#1'
                    },
                    {
                      name: 'end_3#a11989.b596405.c0.d0',
                      value: 43,
                      children: [],
                      btm: {
                        start: '',
                        end: 'a11989.b310713.c0.d0',
                        step: {
                          index: 3,
                          name: 'a11989.b596405.c0.d0',
                          label: '站点一.看板',
                          image_url:
                            'https://data.bytedance.net/byteio/api/v1/file/images/image_c6295d90-498f-46a9-9340-c8c173fce48f.jpeg',
                          page_label: '看板',
                          site_id: '112853',
                          type: 1
                        },
                        pre_steps: [
                          {
                            index: 1,
                            name: 'a11989.b310713.c0.d0'
                          },
                          {
                            index: 2,
                            name: 'a11989.b58640.c0.d0'
                          }
                        ]
                      },
                      btm_data_list: [
                        {
                          uv: 43,
                          pv: 45,
                          avg: 92860.77777777778,
                          pct50: 21536
                        }
                      ],
                      btm_key: 'a11989.b596405.c0.d0',
                      pre_btm_data_list: [
                        {
                          uv: 213,
                          pv: 290,
                          avg: 293909.7344827586,
                          pct50: 60751.5
                        }
                      ],
                      position: 'end_2#4#2'
                    },
                    {
                      name: 'end_3#a11989.b75412.c0.d0',
                      value: 11,
                      children: [],
                      btm: {
                        start: '',
                        end: 'a11989.b310713.c0.d0',
                        step: {
                          index: 3,
                          name: 'a11989.b75412.c0.d0',
                          label: '站点一.留存分析',
                          image_url:
                            'https://data.bytedance.net/byteio/api/v1/file/images/image_3fc3203e-e93d-4de2-9db7-f9cb9c346121.jpeg',
                          page_label: '留存分析',
                          site_id: '112853',
                          type: 1
                        },
                        pre_steps: [
                          {
                            index: 1,
                            name: 'a11989.b310713.c0.d0'
                          },
                          {
                            index: 2,
                            name: 'a11989.b58640.c0.d0'
                          }
                        ]
                      },
                      btm_data_list: [
                        {
                          uv: 11,
                          pv: 11,
                          avg: 41769.63636363636,
                          pct50: 4459
                        }
                      ],
                      btm_key: 'a11989.b75412.c0.d0',
                      pre_btm_data_list: [
                        {
                          uv: 213,
                          pv: 290,
                          avg: 293909.7344827586,
                          pct50: 60751.5
                        }
                      ],
                      position: 'end_2#4#3'
                    },
                    {
                      name: 'end_3#a11989.b0.c0.d0',
                      value: 4,
                      children: [],
                      btm: {
                        start: '',
                        end: 'a11989.b310713.c0.d0',
                        step: {
                          index: 3,
                          name: 'a11989.b0.c0.d0',
                          label: '站点一',
                          image_url:
                            'https://data.bytedance.net/byteio/api/v1/file/images/image_4ddc79dd-87db-4e1a-b756-e749e7116c87.jpg',
                          type: 0
                        },
                        pre_steps: [
                          {
                            index: 1,
                            name: 'a11989.b310713.c0.d0'
                          },
                          {
                            index: 2,
                            name: 'a11989.b58640.c0.d0'
                          }
                        ]
                      },
                      btm_data_list: [
                        {
                          uv: 4,
                          pv: 4,
                          avg: 24670.25,
                          pct50: 15404
                        }
                      ],
                      btm_key: 'a11989.b0.c0.d0',
                      pre_btm_data_list: [
                        {
                          uv: 213,
                          pv: 290,
                          avg: 293909.7344827586,
                          pct50: 60751.5
                        }
                      ],
                      position: 'end_2#4#4'
                    },
                    {
                      name: 'expand_from_end_3_a11989.b310713.c0.d0',
                      position: 'end_3'
                    }
                  ],
                  btm: {
                    start: '',
                    end: 'a11989.b310713.c0.d0',
                    step: {
                      index: 2,
                      name: 'a11989.b58640.c0.d0',
                      label: '站点一.转化分析',
                      image_url:
                        'https://data.bytedance.net/byteio/api/v1/file/images/image_8743eb98-81e3-4069-8496-1527e16e7800.jpeg',
                      page_label: '转化分析',
                      site_id: '112853',
                      type: 1
                    },
                    pre_steps: [
                      {
                        index: 1,
                        name: 'a11989.b310713.c0.d0'
                      }
                    ]
                  },
                  btm_data_list: [
                    {
                      uv: 213,
                      pv: 290,
                      avg: 293909.7344827586,
                      pct50: 60751.5
                    }
                  ],
                  btm_key: 'a11989.b58640.c0.d0',
                  pre_btm_data_list: [
                    {
                      uv: 8054,
                      pv: 32055,
                      avg: 74015.07100296365,
                      pct50: 0
                    }
                  ],
                  hasChild: true
                },
                {
                  name: 'expand_from_center',
                  value: 1,
                  position: 'end_2'
                }
              ],
              btm: {
                start: '',
                end: 'a11989.b310713.c0.d0',
                step: {
                  index: 1,
                  name: 'a11989.b310713.c0.d0',
                  label: '站点一.事件分析',
                  image_url:
                    'https://data.bytedance.net/byteio/api/v1/file/images/image_59cd32a2-3072-49b5-96e8-4766066f8bdc.jpeg',
                  page_label: '事件分析',
                  site_id: '112853',
                  type: 1
                },
                pre_steps: [
                  {
                    index: 1,
                    name: 'a11989.b310713.c0.d0'
                  }
                ]
              },
              btm_data_list: [
                {
                  uv: 8054,
                  pv: 32055,
                  avg: 74015.07100296365,
                  pct50: 0
                }
              ],
              btm_key: 'a11989.b310713.c0.d0'
            }
          ]
        }
      ]
    },
    {
      id: 'sankeyNodes',
      values: [
        {
          name: 'a11989.b310713.c0.d0',
          value: 8054,
          position: 'end_1',
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 1,
              name: 'a11989.b310713.c0.d0',
              label: '站点一.事件分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_59cd32a2-3072-49b5-96e8-4766066f8bdc.jpeg',
              page_label: '事件分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 8054,
              pv: 32055,
              avg: 74015.07100296365,
              pct50: 0
            }
          ],
          btm_key: 'a11989.b310713.c0.d0'
        },
        {
          name: 'end_2#a11989.b310713.c0.d0',
          value: 4238,
          position: 'end_2#0',
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 2,
              name: 'a11989.b310713.c0.d0',
              label: '站点一.事件分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_59cd32a2-3072-49b5-96e8-4766066f8bdc.jpeg',
              page_label: '事件分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 4238,
              pv: 10047,
              avg: 639244.0986364089,
              pct50: 114307
            }
          ],
          btm_key: 'a11989.b310713.c0.d0',
          pre_btm_data_list: [
            {
              uv: 8054,
              pv: 32055,
              avg: 74015.07100296365,
              pct50: 0
            }
          ],
          hasChild: false
        },
        {
          name: 'end_2#a11989.b596405.c0.d0',
          value: 3357,
          position: 'end_2#1',
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 2,
              name: 'a11989.b596405.c0.d0',
              label: '站点一.看板',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_c6295d90-498f-46a9-9340-c8c173fce48f.jpeg',
              page_label: '看板',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 3357,
              pv: 7527,
              avg: 215085.0968513352,
              pct50: 19941
            }
          ],
          btm_key: 'a11989.b596405.c0.d0',
          pre_btm_data_list: [
            {
              uv: 8054,
              pv: 32055,
              avg: 74015.07100296365,
              pct50: 0
            }
          ],
          hasChild: false
        },
        {
          name: 'end_2#a11989.b0.c0.d0',
          value: 572,
          position: 'end_2#2',
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 2,
              name: 'a11989.b0.c0.d0',
              label: '站点一',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_4ddc79dd-87db-4e1a-b756-e749e7116c87.jpg',
              type: 0
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 572,
              pv: 762,
              avg: 232897.343832021,
              pct50: 39371.5
            }
          ],
          btm_key: 'a11989.b0.c0.d0',
          pre_btm_data_list: [
            {
              uv: 8054,
              pv: 32055,
              avg: 74015.07100296365,
              pct50: 0
            }
          ],
          hasChild: false
        },
        {
          name: 'end_2#a11989.b09687.c0.d0',
          value: 330,
          position: 'end_2#3',
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 2,
              name: 'a11989.b09687.c0.d0',
              label: '站点一.指标分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_6fa08f36-9d38-4eaa-9f99-7df1b1a2d495.jpeg',
              page_label: '指标分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 330,
              pv: 375,
              avg: 29457.370666666666,
              pct50: 2480
            }
          ],
          btm_key: 'a11989.b09687.c0.d0',
          pre_btm_data_list: [
            {
              uv: 8054,
              pv: 32055,
              avg: 74015.07100296365,
              pct50: 0
            }
          ],
          hasChild: false
        },
        {
          name: 'end_2#a11989.b58640.c0.d0',
          value: 213,
          position: 'end_2#4',
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 2,
              name: 'a11989.b58640.c0.d0',
              label: '站点一.转化分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_8743eb98-81e3-4069-8496-1527e16e7800.jpeg',
              page_label: '转化分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 213,
              pv: 290,
              avg: 293909.7344827586,
              pct50: 60751.5
            }
          ],
          btm_key: 'a11989.b58640.c0.d0',
          pre_btm_data_list: [
            {
              uv: 8054,
              pv: 32055,
              avg: 74015.07100296365,
              pct50: 0
            }
          ],
          hasChild: true
        },
        {
          name: 'expand_from_center',
          value: 1,
          position: 'end_2'
        },
        {
          name: 'end_3#a11989.b310713.c0.d0',
          value: 63,
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 3,
              name: 'a11989.b310713.c0.d0',
              label: '站点一.事件分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_59cd32a2-3072-49b5-96e8-4766066f8bdc.jpeg',
              page_label: '事件分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              },
              {
                index: 2,
                name: 'a11989.b58640.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 63,
              pv: 72,
              avg: 909586.2083333334,
              pct50: 25735
            }
          ],
          btm_key: 'a11989.b310713.c0.d0',
          pre_btm_data_list: [
            {
              uv: 213,
              pv: 290,
              avg: 293909.7344827586,
              pct50: 60751.5
            }
          ],
          position: 'end_2#4#0'
        },
        {
          name: 'end_3#a11989.b58640.c0.d0',
          value: 60,
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 3,
              name: 'a11989.b58640.c0.d0',
              label: '站点一.转化分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_8743eb98-81e3-4069-8496-1527e16e7800.jpeg',
              page_label: '转化分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              },
              {
                index: 2,
                name: 'a11989.b58640.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 60,
              pv: 66,
              avg: 234147.39393939395,
              pct50: 29118
            }
          ],
          btm_key: 'a11989.b58640.c0.d0',
          pre_btm_data_list: [
            {
              uv: 213,
              pv: 290,
              avg: 293909.7344827586,
              pct50: 60751.5
            }
          ],
          position: 'end_2#4#1'
        },
        {
          name: 'end_3#a11989.b596405.c0.d0',
          value: 43,
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 3,
              name: 'a11989.b596405.c0.d0',
              label: '站点一.看板',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_c6295d90-498f-46a9-9340-c8c173fce48f.jpeg',
              page_label: '看板',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              },
              {
                index: 2,
                name: 'a11989.b58640.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 43,
              pv: 45,
              avg: 92860.77777777778,
              pct50: 21536
            }
          ],
          btm_key: 'a11989.b596405.c0.d0',
          pre_btm_data_list: [
            {
              uv: 213,
              pv: 290,
              avg: 293909.7344827586,
              pct50: 60751.5
            }
          ],
          position: 'end_2#4#2'
        },
        {
          name: 'end_3#a11989.b75412.c0.d0',
          value: 11,
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 3,
              name: 'a11989.b75412.c0.d0',
              label: '站点一.留存分析',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_3fc3203e-e93d-4de2-9db7-f9cb9c346121.jpeg',
              page_label: '留存分析',
              site_id: '112853',
              type: 1
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              },
              {
                index: 2,
                name: 'a11989.b58640.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 11,
              pv: 11,
              avg: 41769.63636363636,
              pct50: 4459
            }
          ],
          btm_key: 'a11989.b75412.c0.d0',
          pre_btm_data_list: [
            {
              uv: 213,
              pv: 290,
              avg: 293909.7344827586,
              pct50: 60751.5
            }
          ],
          position: 'end_2#4#3'
        },
        {
          name: 'end_3#a11989.b0.c0.d0',
          value: 4,
          btm: {
            start: '',
            end: 'a11989.b310713.c0.d0',
            step: {
              index: 3,
              name: 'a11989.b0.c0.d0',
              label: '站点一',
              image_url:
                'https://data.bytedance.net/byteio/api/v1/file/images/image_4ddc79dd-87db-4e1a-b756-e749e7116c87.jpg',
              type: 0
            },
            pre_steps: [
              {
                index: 1,
                name: 'a11989.b310713.c0.d0'
              },
              {
                index: 2,
                name: 'a11989.b58640.c0.d0'
              }
            ]
          },
          btm_data_list: [
            {
              uv: 4,
              pv: 4,
              avg: 24670.25,
              pct50: 15404
            }
          ],
          btm_key: 'a11989.b0.c0.d0',
          pre_btm_data_list: [
            {
              uv: 213,
              pv: 290,
              avg: 293909.7344827586,
              pct50: 60751.5
            }
          ],
          position: 'end_2#4#4'
        },
        {
          name: 'expand_from_end_3_a11989.b310713.c0.d0',
          position: 'end_3'
        }
      ]
    }
  ];

  const currentPage = 'a11989.b310713.c0.d0';

  const spec: ISankeyChartSpec = {
    type: 'sankey',
    data,
    nodeKey: datum => datum.name,
    dataId: 'sankeyData',
    // categoryField: 'name',
    // valueField: 'value',
    // sourceField: 'source',
    // targetField: 'target',
    linkWidth: 180,
    nodeAlign: 'start',
    nodeGap: 10,
    minNodeHeight: 32,
    width: undefined,
    nodeWidth: datum => {
      return datum.key === currentPage ? 100 : 12; // 36 = padding 16 + 4 的边宽
    },
    // nodeHeight: datum => {
    //   console.log(datum);
    //   return 35;
    // },
    crossNodeAlign: 'parent',
    iterations: 5,
    height: 546,
    padding: {
      left: ({ width }: ILayoutSpec) => {
        return (width - 572) / 2;
      },
      right: 171,
      bottom: 40,
      top: 90
    },
    label: {
      visible: false
    },
    // interactions: { markIds: ['node', 'link'] },
    node: {
      id: 'node',
      interactive: true,
      state: {
        expandBtn: {
          filter: datum => datum.key.includes('expand'),
          style: {
            fill: '#737A87',
            height: 20
          }
        },
        hover: {
          outerBorder: {
            distance: 2,
            lineWidth: 1,
            stroke: '#1664FF'
          }
        },
        blur: {
          fill: '#1664FF',
          fillOpacity: 0.3
        }
      },
      style: {
        cornerRadius: 5,
        width: datum => (datum.key === currentPage ? 0 : 12),
        fill: datum => {
          if (datum.key === currentPage) {
            return 'transparent';
          }

          if (datum.key.includes('expand')) {
            return '#737A87';
          }

          return '#1664FF';
        }
      }
    },

    link: {
      id: 'link',
      interactive: false,
      style: {
        fill: '#E8EFFF',
        fillOpacity: 1
      },
      state: {
        expandBtn: {
          filter: datum => datum.key.includes('expand'),
          style: {
            fill: '#F1F2F3',
            fillOpacity: 1
          }
        },
        blur: {
          fill: '#1664FF',
          fillOpacity: 0.01
        }
      }
    },

    tooltip: {
      visible: false,
      mark: {
        title: { visible: false }
      }
    },

    emphasis: {
      enable: true,
      trigger: 'hover',
      effect: 'related'
    },
    animation: false, // 关闭动画效果
    minLinkHeight: 5
  };

  const vChart = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  vChart.renderAsync();
  // vChart.renderAsync().then(() => {
  //   setTimeout(() => {
  //     console.log('updateSpec');
  //     vChart.updateSpec(spec4_update);
  //   }, 3000);
  // });
  window['vchart'] = vChart;

  // 监听点击事件
  // vChart.on('click', { level: 'mark' }, ctx => {
  //   console.log('mark', ctx);
  //   vChart.updateState({
  //     // 名称与上方配置要对应
  //     custom_unSelected: {
  //       filter: datum => {
  //         // 数据 type 不相等的进入这个状态
  //         console.log('datum', datum);
  //         return datum.source !== ctx.datum.key && datum.target !== ctx.datum.key;
  //       }
  //     }
  //   });
  // });

  // setTimeout(() => {
  //   console.log(111, data[2]);
  //   vChart.updateData('data', data[2]);
  // }, 2000);

  // vChart.on('click', ctx => {
  //   console.log('click-ctx', ctx);
  //   vChart.updateData('data', [
  //     {
  //       name: 'data',
  //       values: [
  //         {
  //           nodes: [
  //             {
  //               // value: 80,
  //               name: 'B',
  //               children: [
  //                 {
  //                   name: 'top',
  //                   // value: 40,
  //                   children: [
  //                     { name: '00', value: 100 },
  //                     { name: '01', value: 40 }
  //                   ]
  //                 },
  //                 {
  //                   name: 'middle',
  //                   value: 10
  //                 },
  //                 {
  //                   name: 'bottom',
  //                   value: 30
  //                 }
  //               ]
  //             },
  //             {
  //               value: 50,
  //               name: 'C',
  //               children: [
  //                 {
  //                   name: 'top',
  //                   value: 20
  //                 },
  //                 {
  //                   name: 'middle',
  //                   value: 20
  //                 },
  //                 {
  //                   name: 'bottom',
  //                   value: 10
  //                 }
  //               ]
  //             }
  //           ]
  //         }
  //       ]
  //     }
  //   ]);
  // });
};
run();
