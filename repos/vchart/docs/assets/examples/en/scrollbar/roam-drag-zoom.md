---
category: examples
group: scrollBar
title: scrollBar supports zoom and drag
keywords: scrollBar
order: 30-3
cover: /vchart/preview/roam-drag-zoom_1.5.0.png
option: barChart#scrollbar
---

# ScrollBar Supports Zoom and Drag

`scrollBar` can be configured through `roamDrag` and `roamZoom` to achieve canvas scaling and dragging within the control area.

## Key Configuration

- The `roamDrag` attribute is declared as drag configuration
- `roamDrag.rate` property is declared as drag rate, range `[0, 1]`
- The `roamDrag.reverse` property declares whether the drag direction is opposite to the scroll bar movement direction.

- The `roamZoom` property is declared as a zoom configuration
- The `roamZoom.rate` property is declared as the zoom rate, the range is `[0, 1]`
- The `roamDrag.focus` property declares whether to zoom in or out. When it is turned on, the zoom will be centered on the mouse position by default. When it is turned off, the zoom will be centered on the canvas center by default.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  region: [
    {
      id: 'New User Retention'
    }
  ],
  series: [
    {
      id: 'New User Retentionseries0',
      regionId: 'New User Retention',
      type: 'line',
      data: {
        id: 'Next Day',
        values: [
          {
            x: 0,
            y: 0.1409076361,
            originXData: '2022-03-08',
            type: 'Next Day'
          },
          {
            x: 1,
            y: 1.3188993537,
            originXData: '2022-03-09',
            type: 'Next Day'
          },
          {
            x: 2,
            y: 1.2455923386,
            originXData: '2022-03-10',
            type: 'Next Day'
          },
          {
            x: 3,
            y: 1.2286268467,
            originXData: '2022-03-11',
            type: 'Next Day'
          },
          {
            x: 4,
            y: 0.6635827173000001,
            originXData: '2022-03-12',
            type: 'Next Day'
          },
          {
            x: 5,
            y: 4.4137410679,
            originXData: '2022-03-13',
            type: 'Next Day'
          },
          {
            x: 6,
            y: 2.8548178315,
            originXData: '2022-03-14',
            type: 'Next Day'
          },
          {
            x: 7,
            y: 0.0860680761,
            originXData: '2022-03-15',
            type: 'Next Day'
          },
          {
            x: 8,
            y: 1.8834613227,
            originXData: '2022-03-16',
            type: 'Next Day'
          },
          {
            x: 9,
            y: 0.5469446175,
            originXData: '2022-03-17',
            type: 'Next Day'
          },
          {
            x: 10,
            y: 0.9534934966,
            originXData: '2022-03-18',
            type: 'Next Day'
          },
          {
            x: 11,
            y: 0.23807240770000002,
            originXData: '2022-03-19',
            type: 'Next Day'
          },
          {
            x: 12,
            y: 0.8381792741,
            originXData: '2022-03-20',
            type: 'Next Day'
          },
          {
            x: 13,
            y: 1.3620405372,
            originXData: '2022-03-21',
            type: 'Next Day'
          },
          {
            x: 14,
            y: 0.11469389990000001,
            originXData: '2022-03-22',
            type: 'Next Day'
          },
          {
            x: 15,
            y: 0.0045618926,
            originXData: '2022-03-23',
            type: 'Next Day'
          },
          {
            x: 16,
            y: 0.1877787775,
            originXData: '2022-03-24',
            type: 'Next Day'
          },
          {
            x: 17,
            y: 0.23454896120000002,
            originXData: '2022-03-25',
            type: 'Next Day'
          },
          {
            x: 18,
            y: 0.365882325,
            originXData: '2022-03-26',
            type: 'Next Day'
          },
          {
            x: 19,
            y: 1.315165168,
            originXData: '2022-03-27',
            type: 'Next Day'
          },
          {
            x: 20,
            y: 4.4331847643,
            originXData: '2022-03-28',
            type: 'Next Day'
          },
          {
            x: 21,
            y: 0.7855863949,
            originXData: '2022-03-29',
            type: 'Next Day'
          },
          {
            x: 22,
            y: 1.6028056733,
            originXData: '2022-03-30',
            type: 'Next Day'
          },
          {
            x: 23,
            y: 0.1693317789,
            originXData: '2022-03-31',
            type: 'Next Day'
          },
          {
            x: 24,
            y: 2.3491268517,
            originXData: '2022-04-01',
            type: 'Next Day'
          },
          {
            x: 25,
            y: 0.5887020393,
            originXData: '2022-04-02',
            type: 'Next Day'
          },
          {
            x: 26,
            y: 0.10724573080000001,
            originXData: '2022-04-03',
            type: 'Next Day'
          },
          {
            x: 27,
            y: 0.863294231,
            originXData: '2022-04-04',
            type: 'Next Day'
          },
          {
            x: 28,
            y: 0.5513586857,
            originXData: '2022-04-05',
            type: 'Next Day'
          },
          {
            x: 29,
            y: 0.38047755510000003,
            originXData: '2022-04-06',
            type: 'Next Day'
          },
          {
            x: 30,
            y: 0.2272742906,
            originXData: '2022-04-07',
            type: 'Next Day'
          },
          {
            x: 31,
            y: 0.09248027900000001,
            originXData: '2022-04-08',
            type: 'Next Day'
          },
          {
            x: 32,
            y: 0.2611949751,
            originXData: '2022-04-09',
            type: 'Next Day'
          },
          {
            x: 33,
            y: 0.5922099028000001,
            originXData: '2022-04-10',
            type: 'Next Day'
          },
          {
            x: 34,
            y: 0.7117195539000001,
            originXData: '2022-04-11',
            type: 'Next Day'
          },
          {
            x: 35,
            y: 0.9920715356,
            originXData: '2022-04-12',
            type: 'Next Day'
          },
          {
            x: 36,
            y: 0.24664875900000002,
            originXData: '2022-04-13',
            type: 'Next Day'
          },
          {
            x: 37,
            y: 1.9066133253,
            originXData: '2022-04-14',
            type: 'Next Day'
          },
          {
            x: 38,
            y: 1.9761135285,
            originXData: '2022-04-15',
            type: 'Next Day'
          },
          {
            x: 39,
            y: 0.0365223967,
            originXData: '2022-04-16',
            type: 'Next Day'
          },
          {
            x: 40,
            y: 7.3066072501,
            originXData: '2022-04-17',
            type: 'Next Day'
          },
          {
            x: 41,
            y: 0.054342947700000005,
            originXData: '2022-04-18',
            type: 'Next Day'
          },
          {
            x: 42,
            y: 0.3047962651,
            originXData: '2022-04-19',
            type: 'Next Day'
          },
          {
            x: 43,
            y: 3.4348521172,
            originXData: '2022-04-20',
            type: 'Next Day'
          },
          {
            x: 44,
            y: 0.42548063150000004,
            originXData: '2022-04-21',
            type: 'Next Day'
          },
          {
            x: 45,
            y: 2.9927317263,
            originXData: '2022-04-22',
            type: 'Next Day'
          },
          {
            x: 46,
            y: 1.5511016617,
            originXData: '2022-04-23',
            type: 'Next Day'
          },
          {
            x: 47,
            y: 1.0232740831,
            originXData: '2022-04-24',
            type: 'Next Day'
          },
          {
            x: 48,
            y: 0.6264156608,
            originXData: '2022-04-25',
            type: 'Next Day'
          },
          {
            x: 49,
            y: 0.9145805224,
            originXData: '2022-04-26',
            type: 'Next Day'
          },
          {
            x: 50,
            y: 0.0102297733,
            originXData: '2022-04-27',
            type: 'Next Day'
          },
          {
            x: 51,
            y: 1.1807123282,
            originXData: '2022-04-28',
            type: 'Next Day'
          },
          {
            x: 52,
            y: 0.1112301799,
            originXData: '2022-04-29',
            type: 'Next Day'
          },
          {
            x: 53,
            y: 2.1450948504,
            originXData: '2022-04-30',
            type: 'Next Day'
          },
          {
            x: 54,
            y: 0.23367469440000002,
            originXData: '2022-05-01',
            type: 'Next Day'
          },
          {
            x: 55,
            y: 3.0604862988,
            originXData: '2022-05-02',
            type: 'Next Day'
          },
          {
            x: 56,
            y: 0.0663738469,
            originXData: '2022-05-03',
            type: 'Next Day'
          },
          {
            x: 57,
            y: 1.7677426983000002,
            originXData: '2022-05-04',
            type: 'Next Day'
          },
          {
            x: 58,
            y: 6.2940549235,
            originXData: '2022-05-05',
            type: 'Next Day'
          },
          {
            x: 59,
            y: 0.35485793990000003,
            originXData: '2022-05-06',
            type: 'Next Day'
          },
          {
            x: 60,
            y: 0.35695259030000004,
            originXData: '2022-05-07',
            type: 'Next Day'
          },
          {
            x: 61,
            y: 5.9241551841,
            originXData: '2022-05-08',
            type: 'Next Day'
          },
          {
            x: 62,
            y: 17.2114084309,
            originXData: '2022-05-09',
            type: 'Next Day'
          },
          {
            x: 63,
            y: 0.7172088165,
            originXData: '2022-05-10',
            type: 'Next Day'
          },
          {
            x: 64,
            y: 2.298573863,
            originXData: '2022-05-11',
            type: 'Next Day'
          },
          {
            x: 65,
            y: 0.0872105515,
            originXData: '2022-05-12',
            type: 'Next Day'
          },
          {
            x: 66,
            y: 12.1733705064,
            originXData: '2022-05-13',
            type: 'Next Day'
          },
          {
            x: 67,
            y: 0.1354635475,
            originXData: '2022-05-14',
            type: 'Next Day'
          },
          {
            x: 68,
            y: 0.0160306588,
            originXData: '2022-05-15',
            type: 'Next Day'
          },
          {
            x: 69,
            y: 0.5435378464,
            originXData: '2022-05-16',
            type: 'Next Day'
          },
          {
            x: 70,
            y: 0.4152833247,
            originXData: '2022-05-17',
            type: 'Next Day'
          },
          {
            x: 71,
            y: 4.6438174109,
            originXData: '2022-05-18',
            type: 'Next Day'
          },
          {
            x: 72,
            y: 0.006556910700000001,
            originXData: '2022-05-19',
            type: 'Next Day'
          },
          {
            x: 73,
            y: 1.9777027897,
            originXData: '2022-05-20',
            type: 'Next Day'
          },
          {
            x: 74,
            y: 0.6265114754000001,
            originXData: '2022-05-21',
            type: 'Next Day'
          },
          {
            x: 75,
            y: 3.4211491205,
            originXData: '2022-05-22',
            type: 'Next Day'
          },
          {
            x: 76,
            y: 0.9714625887,
            originXData: '2022-05-23',
            type: 'Next Day'
          },
          {
            x: 77,
            y: 2.5257550041,
            originXData: '2022-05-24',
            type: 'Next Day'
          },
          {
            x: 78,
            y: 2.9004843255,
            originXData: '2022-05-25',
            type: 'Next Day'
          },
          {
            x: 79,
            y: 0.9774707077,
            originXData: '2022-05-26',
            type: 'Next Day'
          },
          {
            x: 80,
            y: 0.6807824302000001,
            originXData: '2022-05-27',
            type: 'Next Day'
          },
          {
            x: 81,
            y: 0.1414240303,
            originXData: '2022-05-28',
            type: 'Next Day'
          },
          {
            x: 82,
            y: 0.6787186629,
            originXData: '2022-05-29',
            type: 'Next Day'
          },
          {
            x: 83,
            y: 0.2558753368,
            originXData: '2022-05-30',
            type: 'Next Day'
          },
          {
            x: 84,
            y: 0.9499861337000001,
            originXData: '2022-05-31',
            type: 'Next Day'
          },
          {
            x: 85,
            y: 0.7950351965,
            originXData: '2022-06-01',
            type: 'Next Day'
          },
          {
            x: 86,
            y: 0.6973271256,
            originXData: '2022-06-02',
            type: 'Next Day'
          },
          {
            x: 87,
            y: 2.2944959155999998,
            originXData: '2022-06-03',
            type: 'Next Day'
          },
          {
            x: 88,
            y: 1.3980166117000001,
            originXData: '2022-06-04',
            type: 'Next Day'
          },
          {
            x: 89,
            y: 1.9574096872000002,
            originXData: '2022-06-05',
            type: 'Next Day'
          },
          {
            x: 90,
            y: 0.7605450853,
            originXData: '2022-06-06',
            type: 'Next Day'
          },
          {
            x: 91,
            y: 2.1882831024,
            originXData: '2022-06-07',
            type: 'Next Day'
          },
          {
            x: 92,
            y: 0.6262463155,
            originXData: '2022-06-08',
            type: 'Next Day'
          },
          {
            x: 93,
            y: 0.9286490177000001,
            originXData: '2022-06-09',
            type: 'Next Day'
          },
          {
            x: 94,
            y: 0.8743740971,
            originXData: '2022-06-10',
            type: 'Next Day'
          },
          {
            x: 95,
            y: 1.6554993294,
            originXData: '2022-06-11',
            type: 'Next Day'
          },
          {
            x: 96,
            y: 0.876721771,
            originXData: '2022-06-12',
            type: 'Next Day'
          },
          {
            x: 97,
            y: 0.1992713791,
            originXData: '2022-06-13',
            type: 'Next Day'
          },
          {
            x: 98,
            y: 0.7921401122,
            originXData: '2022-06-14',
            type: 'Next Day'
          },
          {
            x: 99,
            y: 1.9377854600000002,
            originXData: '2022-06-15',
            type: 'Next Day'
          },
          {
            x: 100,
            y: 0.0785511559,
            originXData: '2022-06-16',
            type: 'Next Day'
          },
          {
            x: 101,
            y: 3.2073969635,
            originXData: '2022-06-17',
            type: 'Next Day'
          },
          {
            x: 102,
            y: 8.3336173153,
            originXData: '2022-06-18',
            type: 'Next Day'
          },
          {
            x: 103,
            y: 0.4401972579,
            originXData: '2022-06-19',
            type: 'Next Day'
          },
          {
            x: 104,
            y: 1.168295514,
            originXData: '2022-06-20',
            type: 'Next Day'
          },
          {
            x: 105,
            y: 2.1822533018,
            originXData: '2022-06-21',
            type: 'Next Day'
          },
          {
            x: 106,
            y: 0.6675361691,
            originXData: '2022-06-22',
            type: 'Next Day'
          },
          {
            x: 107,
            y: 0.7180943062,
            originXData: '2022-06-23',
            type: 'Next Day'
          },
          {
            x: 108,
            y: 2.231175166,
            originXData: '2022-06-24',
            type: 'Next Day'
          },
          {
            x: 109,
            y: 14.2858334099,
            originXData: '2022-06-25',
            type: 'Next Day'
          },
          {
            x: 110,
            y: 0.7526575062,
            originXData: '2022-06-26',
            type: 'Next Day'
          },
          {
            x: 111,
            y: 1.2225595774,
            originXData: '2022-06-27',
            type: 'Next Day'
          },
          {
            x: 112,
            y: 0.8102373745,
            originXData: '2022-06-28',
            type: 'Next Day'
          },
          {
            x: 113,
            y: 1.345965919,
            originXData: '2022-06-29',
            type: 'Next Day'
          },
          {
            x: 114,
            y: 0.09483955220000001,
            originXData: '2022-06-30',
            type: 'Next Day'
          },
          {
            x: 115,
            y: 1.5499078319000001,
            originXData: '2022-07-01',
            type: 'Next Day'
          },
          {
            x: 116,
            y: 0.6303543034,
            originXData: '2022-07-02',
            type: 'Next Day'
          },
          {
            x: 117,
            y: 10.2506447355,
            originXData: '2022-07-03',
            type: 'Next Day'
          },
          {
            x: 118,
            y: 0.909182731,
            originXData: '2022-07-04',
            type: 'Next Day'
          },
          {
            x: 119,
            y: 0.2998294637,
            originXData: '2022-07-05',
            type: 'Next Day'
          },
          {
            x: 120,
            y: 1.7811835286000002,
            originXData: '2022-07-06',
            type: 'Next Day'
          },
          {
            x: 121,
            y: 0.0271273538,
            originXData: '2022-07-07',
            type: 'Next Day'
          },
          {
            x: 122,
            y: 0.1254319947,
            originXData: '2022-07-08',
            type: 'Next Day'
          },
          {
            x: 123,
            y: 1.0523312998,
            originXData: '2022-07-09',
            type: 'Next Day'
          },
          {
            x: 124,
            y: 1.344611744,
            originXData: '2022-07-10',
            type: 'Next Day'
          },
          {
            x: 125,
            y: 1.0185602493,
            originXData: '2022-07-11',
            type: 'Next Day'
          },
          {
            x: 126,
            y: 3.0882318619,
            originXData: '2022-07-12',
            type: 'Next Day'
          },
          {
            x: 127,
            y: 0.7707070671,
            originXData: '2022-07-13',
            type: 'Next Day'
          },
          {
            x: 128,
            y: 0.8859828761,
            originXData: '2022-07-14',
            type: 'Next Day'
          },
          {
            x: 129,
            y: 2.33846467,
            originXData: '2022-07-15',
            type: 'Next Day'
          },
          {
            x: 130,
            y: 2.0330114627,
            originXData: '2022-07-16',
            type: 'Next Day'
          },
          {
            x: 131,
            y: 0.8101919509000001,
            originXData: '2022-07-17',
            type: 'Next Day'
          },
          {
            x: 132,
            y: 0.6561404439,
            originXData: '2022-07-18',
            type: 'Next Day'
          },
          {
            x: 133,
            y: 0.1787013891,
            originXData: '2022-07-19',
            type: 'Next Day'
          },
          {
            x: 134,
            y: 0.0473016526,
            originXData: '2022-07-20',
            type: 'Next Day'
          },
          {
            x: 135,
            y: 1.6806954327999999,
            originXData: '2022-07-21',
            type: 'Next Day'
          },
          {
            x: 136,
            y: 15.9155295995,
            originXData: '2022-07-22',
            type: 'Next Day'
          },
          {
            x: 137,
            y: 0.9846981716000001,
            originXData: '2022-07-23',
            type: 'Next Day'
          },
          {
            x: 138,
            y: 0.9361073675,
            originXData: '2022-07-24',
            type: 'Next Day'
          },
          {
            x: 139,
            y: 16.8989782621,
            originXData: '2022-07-25',
            type: 'Next Day'
          },
          {
            x: 140,
            y: 0.5467904472,
            originXData: '2022-07-26',
            type: 'Next Day'
          },
          {
            x: 141,
            y: 1.3517651956,
            originXData: '2022-07-27',
            type: 'Next Day'
          },
          {
            x: 142,
            y: 0.9850867424,
            originXData: '2022-07-28',
            type: 'Next Day'
          },
          {
            x: 143,
            y: 2.1177139539,
            originXData: '2022-07-29',
            type: 'Next Day'
          },
          {
            x: 144,
            y: 0.6126976686,
            originXData: '2022-07-30',
            type: 'Next Day'
          },
          {
            x: 145,
            y: 1.5962988152,
            originXData: '2022-07-31',
            type: 'Next Day'
          },
          {
            x: 146,
            y: 2.1928640988,
            originXData: '2022-08-01',
            type: 'Next Day'
          },
          {
            x: 147,
            y: 0.8091044466,
            originXData: '2022-08-02',
            type: 'Next Day'
          },
          {
            x: 148,
            y: 0.9720937185,
            originXData: '2022-08-03',
            type: 'Next Day'
          },
          {
            x: 149,
            y: 0.1333895815,
            originXData: '2022-08-04',
            type: 'Next Day'
          },
          {
            x: 150,
            y: 1.0730400389,
            originXData: '2022-08-05',
            type: 'Next Day'
          },
          {
            x: 151,
            y: 2.1694729518,
            originXData: '2022-08-06',
            type: 'Next Day'
          },
          {
            x: 152,
            y: 2.0425559535,
            originXData: '2022-08-07',
            type: 'Next Day'
          },
          {
            x: 153,
            y: 0.6835983498,
            originXData: '2022-08-08',
            type: 'Next Day'
          },
          {
            x: 154,
            y: 19.6580394767,
            originXData: '2022-08-09',
            type: 'Next Day'
          },
          {
            x: 155,
            y: 0.0753631097,
            originXData: '2022-08-10',
            type: 'Next Day'
          },
          {
            x: 156,
            y: 8.4916268026,
            originXData: '2022-08-11',
            type: 'Next Day'
          },
          {
            x: 157,
            y: 1.8651593042,
            originXData: '2022-08-12',
            type: 'Next Day'
          },
          {
            x: 158,
            y: 3.3190348179,
            originXData: '2022-08-13',
            type: 'Next Day'
          },
          {
            x: 159,
            y: 2.2086940162,
            originXData: '2022-08-14',
            type: 'Next Day'
          },
          {
            x: 160,
            y: 3.3420604369999998,
            originXData: '2022-08-15',
            type: 'Next Day'
          },
          {
            x: 161,
            y: 2.1531261848,
            originXData: '2022-08-16',
            type: 'Next Day'
          },
          {
            x: 162,
            y: 0.9297068873000001,
            originXData: '2022-08-17',
            type: 'Next Day'
          },
          {
            x: 163,
            y: 1.4720270901,
            originXData: '2022-08-18',
            type: 'Next Day'
          },
          {
            x: 164,
            y: 1.0890692382,
            originXData: '2022-08-19',
            type: 'Next Day'
          },
          {
            x: 165,
            y: 3.2225781993,
            originXData: '2022-08-20',
            type: 'Next Day'
          },
          {
            x: 166,
            y: 0.1868291575,
            originXData: '2022-08-21',
            type: 'Next Day'
          },
          {
            x: 167,
            y: 0.8240316709000001,
            originXData: '2022-08-22',
            type: 'Next Day'
          },
          {
            x: 168,
            y: 10.9576651145,
            originXData: '2022-08-23',
            type: 'Next Day'
          },
          {
            x: 169,
            y: 0.7620774354000001,
            originXData: '2022-08-24',
            type: 'Next Day'
          },
          {
            x: 170,
            y: 0.1135604092,
            originXData: '2022-08-25',
            type: 'Next Day'
          },
          {
            x: 171,
            y: 0.8441680374,
            originXData: '2022-08-26',
            type: 'Next Day'
          },
          {
            x: 172,
            y: 0.6705818849,
            originXData: '2022-08-27',
            type: 'Next Day'
          },
          {
            x: 173,
            y: 3.2359735892,
            originXData: '2022-08-28',
            type: 'Next Day'
          },
          {
            x: 174,
            y: 3.1844789352,
            originXData: '2022-08-29',
            type: 'Next Day'
          },
          {
            x: 175,
            y: 2.2506939807,
            originXData: '2022-08-30',
            type: 'Next Day'
          },
          {
            x: 176,
            y: 1.7795796297000002,
            originXData: '2022-08-31',
            type: 'Next Day'
          },
          {
            x: 177,
            y: 0.5339517384,
            originXData: '2022-09-01',
            type: 'Next Day'
          },
          {
            x: 178,
            y: 0.027891956500000002,
            originXData: '2022-09-02',
            type: 'Next Day'
          }
        ]
      },
      xField: ['x'],
      yField: 'y',
      seriesField: 'type',
      label: {
        visible: false,
        style: {
          visible: false
        }
      },
      point: {
        zindex: 10,
        visible: false,
        style: {
          fill: '#3478F6'
        }
      },
      invalidType: 'break',
      line: {
        zindex: 5,
        style: {
          stroke: '#3478F6',
          lineWidth: 1
        }
      }
    },
    {
      id: 'New User Retentionseries1',
      regionId: 'New User Retention',
      type: 'line',
      data: {
        id: 'Day 7',
        values: [
          {
            x: 0,
            y: 0.4063045006,
            originXData: '2022-03-08',
            type: 'Day 7'
          },
          {
            x: 1,
            y: 0.47876701520000003,
            originXData: '2022-03-09',
            type: 'Day 7'
          },
          {
            x: 2,
            y: 0.0480865669,
            originXData: '2022-03-10',
            type: 'Day 7'
          },
          {
            x: 3,
            y: 0.5193984665,
            originXData: '2022-03-11',
            type: 'Day 7'
          },
          {
            x: 4,
            y: 0.2982874662,
            originXData: '2022-03-12',
            type: 'Day 7'
          },
          {
            x: 5,
            y: 0.40913993930000003,
            originXData: '2022-03-13',
            type: 'Day 7'
          },
          {
            x: 6,
            y: 2.07463404,
            originXData: '2022-03-14',
            type: 'Day 7'
          },
          {
            x: 7,
            y: 2.405068672,
            originXData: '2022-03-15',
            type: 'Day 7'
          },
          {
            x: 8,
            y: 0.6167997099,
            originXData: '2022-03-16',
            type: 'Day 7'
          },
          {
            x: 9,
            y: 1.4882947458,
            originXData: '2022-03-17',
            type: 'Day 7'
          },
          {
            x: 10,
            y: 0.5292360392000001,
            originXData: '2022-03-18',
            type: 'Day 7'
          },
          {
            x: 11,
            y: 0.5467290714,
            originXData: '2022-03-19',
            type: 'Day 7'
          },
          {
            x: 12,
            y: 1.2683342684,
            originXData: '2022-03-20',
            type: 'Day 7'
          },
          {
            x: 13,
            y: 1.0101105881,
            originXData: '2022-03-21',
            type: 'Day 7'
          },
          {
            x: 14,
            y: 1.1909177664,
            originXData: '2022-03-22',
            type: 'Day 7'
          },
          {
            x: 15,
            y: 0.4159635471,
            originXData: '2022-03-23',
            type: 'Day 7'
          },
          {
            x: 16,
            y: 0.1772533631,
            originXData: '2022-03-24',
            type: 'Day 7'
          },
          {
            x: 17,
            y: 0.1538678974,
            originXData: '2022-03-25',
            type: 'Day 7'
          },
          {
            x: 18,
            y: 0.8446512623,
            originXData: '2022-03-26',
            type: 'Day 7'
          },
          {
            x: 19,
            y: 0.6055792409,
            originXData: '2022-03-27',
            type: 'Day 7'
          },
          {
            x: 20,
            y: 3.0482940999,
            originXData: '2022-03-28',
            type: 'Day 7'
          },
          {
            x: 21,
            y: 1.5534968942,
            originXData: '2022-03-29',
            type: 'Day 7'
          },
          {
            x: 22,
            y: 1.087949409,
            originXData: '2022-03-30',
            type: 'Day 7'
          },
          {
            x: 23,
            y: 0.2872415206,
            originXData: '2022-03-31',
            type: 'Day 7'
          },
          {
            x: 24,
            y: 1.8963241693000001,
            originXData: '2022-04-01',
            type: 'Day 7'
          },
          {
            x: 25,
            y: 0.7327348142,
            originXData: '2022-04-02',
            type: 'Day 7'
          },
          {
            x: 26,
            y: 0.9610421835,
            originXData: '2022-04-03',
            type: 'Day 7'
          },
          {
            x: 27,
            y: 0.7497605576,
            originXData: '2022-04-04',
            type: 'Day 7'
          },
          {
            x: 28,
            y: 0.0448602345,
            originXData: '2022-04-05',
            type: 'Day 7'
          },
          {
            x: 29,
            y: 0.5762412739,
            originXData: '2022-04-06',
            type: 'Day 7'
          },
          {
            x: 30,
            y: 1.0074633659,
            originXData: '2022-04-07',
            type: 'Day 7'
          },
          {
            x: 31,
            y: 3.1631430433,
            originXData: '2022-04-08',
            type: 'Day 7'
          },
          {
            x: 32,
            y: 0.2807681201,
            originXData: '2022-04-09',
            type: 'Day 7'
          },
          {
            x: 33,
            y: 0.18406702160000002,
            originXData: '2022-04-10',
            type: 'Day 7'
          },
          {
            x: 34,
            y: 0.5206819792,
            originXData: '2022-04-11',
            type: 'Day 7'
          },
          {
            x: 35,
            y: 0.8399234561000001,
            originXData: '2022-04-12',
            type: 'Day 7'
          },
          {
            x: 36,
            y: 0.7053988967,
            originXData: '2022-04-13',
            type: 'Day 7'
          },
          {
            x: 37,
            y: 0.7912075514,
            originXData: '2022-04-14',
            type: 'Day 7'
          },
          {
            x: 38,
            y: 0.7567186648,
            originXData: '2022-04-15',
            type: 'Day 7'
          },
          {
            x: 39,
            y: 1.2090217183,
            originXData: '2022-04-16',
            type: 'Day 7'
          },
          {
            x: 40,
            y: 1.1099626082,
            originXData: '2022-04-17',
            type: 'Day 7'
          },
          {
            x: 41,
            y: 0.066270457,
            originXData: '2022-04-18',
            type: 'Day 7'
          },
          {
            x: 42,
            y: 0.7169028654,
            originXData: '2022-04-19',
            type: 'Day 7'
          },
          {
            x: 43,
            y: 0.36513293550000003,
            originXData: '2022-04-20',
            type: 'Day 7'
          },
          {
            x: 44,
            y: 1.9579864294,
            originXData: '2022-04-21',
            type: 'Day 7'
          },
          {
            x: 45,
            y: 3.2653220467,
            originXData: '2022-04-22',
            type: 'Day 7'
          },
          {
            x: 46,
            y: 0.5399111118000001,
            originXData: '2022-04-23',
            type: 'Day 7'
          },
          {
            x: 47,
            y: 1.1942111019000001,
            originXData: '2022-04-24',
            type: 'Day 7'
          },
          {
            x: 48,
            y: 0.0802659321,
            originXData: '2022-04-25',
            type: 'Day 7'
          },
          {
            x: 49,
            y: 2.1498524612,
            originXData: '2022-04-26',
            type: 'Day 7'
          },
          {
            x: 50,
            y: 1.3919173388,
            originXData: '2022-04-27',
            type: 'Day 7'
          },
          {
            x: 51,
            y: 1.6064761709000002,
            originXData: '2022-04-28',
            type: 'Day 7'
          },
          {
            x: 52,
            y: 1.1302946944,
            originXData: '2022-04-29',
            type: 'Day 7'
          },
          {
            x: 53,
            y: 6.0750208429,
            originXData: '2022-04-30',
            type: 'Day 7'
          },
          {
            x: 54,
            y: 0.393046218,
            originXData: '2022-05-01',
            type: 'Day 7'
          },
          {
            x: 55,
            y: 1.4503119551,
            originXData: '2022-05-02',
            type: 'Day 7'
          },
          {
            x: 56,
            y: 0.1343430393,
            originXData: '2022-05-03',
            type: 'Day 7'
          },
          {
            x: 57,
            y: 2.4396242861,
            originXData: '2022-05-04',
            type: 'Day 7'
          },
          {
            x: 58,
            y: 4.1652544325,
            originXData: '2022-05-05',
            type: 'Day 7'
          },
          {
            x: 59,
            y: 0.4289477136,
            originXData: '2022-05-06',
            type: 'Day 7'
          },
          {
            x: 60,
            y: 0.3520032732,
            originXData: '2022-05-07',
            type: 'Day 7'
          },
          {
            x: 61,
            y: 2.6464756903,
            originXData: '2022-05-08',
            type: 'Day 7'
          },
          {
            x: 62,
            y: 8.2128231515,
            originXData: '2022-05-09',
            type: 'Day 7'
          },
          {
            x: 63,
            y: 5.0331869484,
            originXData: '2022-05-10',
            type: 'Day 7'
          },
          {
            x: 64,
            y: 1.0375048821,
            originXData: '2022-05-11',
            type: 'Day 7'
          },
          {
            x: 65,
            y: 0.4729673414,
            originXData: '2022-05-12',
            type: 'Day 7'
          },
          {
            x: 66,
            y: 6.1923815878,
            originXData: '2022-05-13',
            type: 'Day 7'
          },
          {
            x: 67,
            y: 0.8287866461000001,
            originXData: '2022-05-14',
            type: 'Day 7'
          },
          {
            x: 68,
            y: 0.43167492360000004,
            originXData: '2022-05-15',
            type: 'Day 7'
          },
          {
            x: 69,
            y: 0.10118202080000001,
            originXData: '2022-05-16',
            type: 'Day 7'
          },
          {
            x: 70,
            y: 0.29932501510000004,
            originXData: '2022-05-17',
            type: 'Day 7'
          },
          {
            x: 71,
            y: 4.2067359283,
            originXData: '2022-05-18',
            type: 'Day 7'
          },
          {
            x: 72,
            y: 0.0535457515,
            originXData: '2022-05-19',
            type: 'Day 7'
          },
          {
            x: 73,
            y: 1.04118346,
            originXData: '2022-05-20',
            type: 'Day 7'
          },
          {
            x: 74,
            y: 2.115937107,
            originXData: '2022-05-21',
            type: 'Day 7'
          },
          {
            x: 75,
            y: 2.2615850603,
            originXData: '2022-05-22',
            type: 'Day 7'
          },
          {
            x: 76,
            y: 0.7225903808,
            originXData: '2022-05-23',
            type: 'Day 7'
          },
          {
            x: 77,
            y: 0.4983877632,
            originXData: '2022-05-24',
            type: 'Day 7'
          },
          {
            x: 78,
            y: 2.1666990419,
            originXData: '2022-05-25',
            type: 'Day 7'
          },
          {
            x: 79,
            y: 0.2098311925,
            originXData: '2022-05-26',
            type: 'Day 7'
          },
          {
            x: 80,
            y: 1.1770688848,
            originXData: '2022-05-27',
            type: 'Day 7'
          },
          {
            x: 81,
            y: 1.2569628473,
            originXData: '2022-05-28',
            type: 'Day 7'
          },
          {
            x: 82,
            y: 0.1170387038,
            originXData: '2022-05-29',
            type: 'Day 7'
          },
          {
            x: 83,
            y: 1.5566161129,
            originXData: '2022-05-30',
            type: 'Day 7'
          },
          {
            x: 84,
            y: 0.7446926157,
            originXData: '2022-05-31',
            type: 'Day 7'
          },
          {
            x: 85,
            y: 0.7381211205,
            originXData: '2022-06-01',
            type: 'Day 7'
          },
          {
            x: 86,
            y: 0.045710699300000004,
            originXData: '2022-06-02',
            type: 'Day 7'
          },
          {
            x: 87,
            y: 3.2373068449,
            originXData: '2022-06-03',
            type: 'Day 7'
          },
          {
            x: 88,
            y: 1.4975074739,
            originXData: '2022-06-04',
            type: 'Day 7'
          },
          {
            x: 89,
            y: 0.913627347,
            originXData: '2022-06-05',
            type: 'Day 7'
          },
          {
            x: 90,
            y: 0.8542636058,
            originXData: '2022-06-06',
            type: 'Day 7'
          },
          {
            x: 91,
            y: 2.6871871317,
            originXData: '2022-06-07',
            type: 'Day 7'
          },
          {
            x: 92,
            y: 1.0041575194,
            originXData: '2022-06-08',
            type: 'Day 7'
          },
          {
            x: 93,
            y: 0.9800272807,
            originXData: '2022-06-09',
            type: 'Day 7'
          },
          {
            x: 94,
            y: 1.2212615251,
            originXData: '2022-06-10',
            type: 'Day 7'
          },
          {
            x: 95,
            y: 1.0555028722,
            originXData: '2022-06-11',
            type: 'Day 7'
          },
          {
            x: 96,
            y: 0.029779803400000002,
            originXData: '2022-06-12',
            type: 'Day 7'
          },
          {
            x: 97,
            y: 0.6400767713000001,
            originXData: '2022-06-13',
            type: 'Day 7'
          },
          {
            x: 98,
            y: 0.0614040547,
            originXData: '2022-06-14',
            type: 'Day 7'
          },
          {
            x: 99,
            y: 6.1215452805,
            originXData: '2022-06-15',
            type: 'Day 7'
          },
          {
            x: 100,
            y: 1.0795372807,
            originXData: '2022-06-16',
            type: 'Day 7'
          },
          {
            x: 101,
            y: 9.2898549152,
            originXData: '2022-06-17',
            type: 'Day 7'
          },
          {
            x: 102,
            y: 2.5080581855,
            originXData: '2022-06-18',
            type: 'Day 7'
          },
          {
            x: 103,
            y: 0.2157982169,
            originXData: '2022-06-19',
            type: 'Day 7'
          },
          {
            x: 104,
            y: 0.7598488,
            originXData: '2022-06-20',
            type: 'Day 7'
          },
          {
            x: 105,
            y: 0.15494734500000001,
            originXData: '2022-06-21',
            type: 'Day 7'
          },
          {
            x: 106,
            y: 0.5023645317000001,
            originXData: '2022-06-22',
            type: 'Day 7'
          },
          {
            x: 107,
            y: 0.39185195770000003,
            originXData: '2022-06-23',
            type: 'Day 7'
          },
          {
            x: 108,
            y: 0.0677054376,
            originXData: '2022-06-24',
            type: 'Day 7'
          },
          {
            x: 109,
            y: 3.6312534247,
            originXData: '2022-06-25',
            type: 'Day 7'
          },
          {
            x: 110,
            y: 0.891978092,
            originXData: '2022-06-26',
            type: 'Day 7'
          },
          {
            x: 111,
            y: 0.8733539477000001,
            originXData: '2022-06-27',
            type: 'Day 7'
          },
          {
            x: 112,
            y: 0.34523662190000004,
            originXData: '2022-06-28',
            type: 'Day 7'
          },
          {
            x: 113,
            y: 1.0992677234000001,
            originXData: '2022-06-29',
            type: 'Day 7'
          },
          {
            x: 114,
            y: 1.1434675393,
            originXData: '2022-06-30',
            type: 'Day 7'
          },
          {
            x: 115,
            y: 4.7568039236,
            originXData: '2022-07-01',
            type: 'Day 7'
          },
          {
            x: 116,
            y: 0.4277852347,
            originXData: '2022-07-02',
            type: 'Day 7'
          },
          {
            x: 117,
            y: 1.9144151094000001,
            originXData: '2022-07-03',
            type: 'Day 7'
          },
          {
            x: 118,
            y: 0.5539915437,
            originXData: '2022-07-04',
            type: 'Day 7'
          },
          {
            x: 119,
            y: 1.1316897105,
            originXData: '2022-07-05',
            type: 'Day 7'
          },
          {
            x: 120,
            y: 6.1036469049,
            originXData: '2022-07-06',
            type: 'Day 7'
          },
          {
            x: 121,
            y: 1.5032742971,
            originXData: '2022-07-07',
            type: 'Day 7'
          },
          {
            x: 122,
            y: 1.2649614857,
            originXData: '2022-07-08',
            type: 'Day 7'
          },
          {
            x: 123,
            y: 1.6642710064,
            originXData: '2022-07-09',
            type: 'Day 7'
          },
          {
            x: 124,
            y: 0.9214131181,
            originXData: '2022-07-10',
            type: 'Day 7'
          },
          {
            x: 125,
            y: 0.1262049188,
            originXData: '2022-07-11',
            type: 'Day 7'
          },
          {
            x: 126,
            y: 1.204943278,
            originXData: '2022-07-12',
            type: 'Day 7'
          },
          {
            x: 127,
            y: 1.0885742344,
            originXData: '2022-07-13',
            type: 'Day 7'
          },
          {
            x: 128,
            y: 0.9930958780000001,
            originXData: '2022-07-14',
            type: 'Day 7'
          },
          {
            x: 129,
            y: 1.7832478285,
            originXData: '2022-07-15',
            type: 'Day 7'
          },
          {
            x: 130,
            y: 3.5268543828,
            originXData: '2022-07-16',
            type: 'Day 7'
          },
          {
            x: 131,
            y: 0.3539506001,
            originXData: '2022-07-17',
            type: 'Day 7'
          },
          {
            x: 132,
            y: 1.3927338705,
            originXData: '2022-07-18',
            type: 'Day 7'
          },
          {
            x: 133,
            y: 1.2206493844,
            originXData: '2022-07-19',
            type: 'Day 7'
          },
          {
            x: 134,
            y: 0.8344916045,
            originXData: '2022-07-20',
            type: 'Day 7'
          },
          {
            x: 135,
            y: 5.12977801,
            originXData: '2022-07-21',
            type: 'Day 7'
          },
          {
            x: 136,
            y: 10.1189711415,
            originXData: '2022-07-22',
            type: 'Day 7'
          },
          {
            x: 137,
            y: 1.0647054056,
            originXData: '2022-07-23',
            type: 'Day 7'
          },
          {
            x: 138,
            y: 1.1411706144,
            originXData: '2022-07-24',
            type: 'Day 7'
          },
          {
            x: 139,
            y: 9.3481046746,
            originXData: '2022-07-25',
            type: 'Day 7'
          },
          {
            x: 140,
            y: 0.07995025530000001,
            originXData: '2022-07-26',
            type: 'Day 7'
          },
          {
            x: 141,
            y: 0.7620325274,
            originXData: '2022-07-27',
            type: 'Day 7'
          },
          {
            x: 142,
            y: 0.404955249,
            originXData: '2022-07-28',
            type: 'Day 7'
          },
          {
            x: 143,
            y: 1.0065995757,
            originXData: '2022-07-29',
            type: 'Day 7'
          },
          {
            x: 144,
            y: 1.2730675119,
            originXData: '2022-07-30',
            type: 'Day 7'
          },
          {
            x: 145,
            y: 0.1738178755,
            originXData: '2022-07-31',
            type: 'Day 7'
          },
          {
            x: 146,
            y: 2.2391629461,
            originXData: '2022-08-01',
            type: 'Day 7'
          },
          {
            x: 147,
            y: 1.3734861688,
            originXData: '2022-08-02',
            type: 'Day 7'
          },
          {
            x: 148,
            y: 1.0236009704,
            originXData: '2022-08-03',
            type: 'Day 7'
          },
          {
            x: 149,
            y: 0.4336063067,
            originXData: '2022-08-04',
            type: 'Day 7'
          },
          {
            x: 150,
            y: 0.9771716414,
            originXData: '2022-08-05',
            type: 'Day 7'
          },
          {
            x: 151,
            y: 1.6807596403,
            originXData: '2022-08-06',
            type: 'Day 7'
          },
          {
            x: 152,
            y: 0.5996570228,
            originXData: '2022-08-07',
            type: 'Day 7'
          },
          {
            x: 153,
            y: 0.2342424023,
            originXData: '2022-08-08',
            type: 'Day 7'
          },
          {
            x: 154,
            y: 15.8818561178,
            originXData: '2022-08-09',
            type: 'Day 7'
          },
          {
            x: 155,
            y: 1.6943663376,
            originXData: '2022-08-10',
            type: 'Day 7'
          },
          {
            x: 156,
            y: 7.4015853638,
            originXData: '2022-08-11',
            type: 'Day 7'
          },
          {
            x: 157,
            y: 1.6587187096,
            originXData: '2022-08-12',
            type: 'Day 7'
          },
          {
            x: 158,
            y: 2.3837261941,
            originXData: '2022-08-13',
            type: 'Day 7'
          },
          {
            x: 159,
            y: 1.1563377979,
            originXData: '2022-08-14',
            type: 'Day 7'
          },
          {
            x: 160,
            y: 1.8662035369,
            originXData: '2022-08-15',
            type: 'Day 7'
          },
          {
            x: 161,
            y: 0.9801696753,
            originXData: '2022-08-16',
            type: 'Day 7'
          },
          {
            x: 162,
            y: 0.7818117424000001,
            originXData: '2022-08-17',
            type: 'Day 7'
          },
          {
            x: 163,
            y: 0.9325881454,
            originXData: '2022-08-18',
            type: 'Day 7'
          },
          {
            x: 164,
            y: 0.6412463979,
            originXData: '2022-08-19',
            type: 'Day 7'
          },
          {
            x: 165,
            y: 4.5087015732,
            originXData: '2022-08-20',
            type: 'Day 7'
          },
          {
            x: 166,
            y: 0.7721117724000001,
            originXData: '2022-08-21',
            type: 'Day 7'
          },
          {
            x: 167,
            y: 0.292392547,
            originXData: '2022-08-22',
            type: 'Day 7'
          },
          {
            x: 168,
            y: 12.732565852,
            originXData: '2022-08-23',
            type: 'Day 7'
          },
          {
            x: 169,
            y: 2.042955381,
            originXData: '2022-08-24',
            type: 'Day 7'
          },
          {
            x: 170,
            y: 0.4920631489,
            originXData: '2022-08-25',
            type: 'Day 7'
          },
          {
            x: 171,
            y: 3.4193876227,
            originXData: '2022-08-26',
            type: 'Day 7'
          },
          {
            x: 172,
            y: 1.7272937289999999,
            originXData: '2022-08-27',
            type: 'Day 7'
          },
          {
            x: 173,
            y: null,
            originXData: '2022-08-28',
            type: 'Day 7'
          },
          {
            x: 174,
            y: null,
            originXData: '2022-08-29',
            type: 'Day 7'
          },
          {
            x: 175,
            y: null,
            originXData: '2022-08-30',
            type: 'Day 7'
          },
          {
            x: 176,
            y: null,
            originXData: '2022-08-31',
            type: 'Day 7'
          },
          {
            x: 177,
            y: null,
            originXData: '2022-09-01',
            type: 'Day 7'
          },
          {
            x: 178,
            y: null,
            originXData: '2022-09-02',
            type: 'Day 7'
          }
        ]
      },
      xField: ['x'],
      yField: 'y',
      seriesField: 'type',
      label: {
        visible: false,
        style: {
          visible: false
        }
      },
      point: {
        zindex: 10,
        visible: false,
        style: {
          fill: '#65C466'
        }
      },
      invalidType: 'break',
      line: {
        zindex: 5,
        style: {
          stroke: '#65C466',
          lineWidth: 1
        }
      }
    },
    {
      id: 'New User Retentionseries2',
      regionId: 'New User Retention',
      type: 'line',
      data: {
        id: 'Day 30',
        values: [
          {
            x: 0,
            y: 0.9415902384,
            originXData: '2022-03-08',
            type: 'Day 30'
          },
          {
            x: 1,
            y: 0.9191159369,
            originXData: '2022-03-09',
            type: 'Day 30'
          },
          {
            x: 2,
            y: 1.2976435919,
            originXData: '2022-03-10',
            type: 'Day 30'
          },
          {
            x: 3,
            y: 0.3186273892,
            originXData: '2022-03-11',
            type: 'Day 30'
          },
          {
            x: 4,
            y: 0.2893812679,
            originXData: '2022-03-12',
            type: 'Day 30'
          },
          {
            x: 5,
            y: 1.9603139615,
            originXData: '2022-03-13',
            type: 'Day 30'
          },
          {
            x: 6,
            y: 0.8562007403,
            originXData: '2022-03-14',
            type: 'Day 30'
          },
          {
            x: 7,
            y: 2.7627785606,
            originXData: '2022-03-15',
            type: 'Day 30'
          },
          {
            x: 8,
            y: 4.8938176273,
            originXData: '2022-03-16',
            type: 'Day 30'
          },
          {
            x: 9,
            y: 0.6985841108,
            originXData: '2022-03-17',
            type: 'Day 30'
          },
          {
            x: 10,
            y: 1.2731528101,
            originXData: '2022-03-18',
            type: 'Day 30'
          },
          {
            x: 11,
            y: 1.0443019042,
            originXData: '2022-03-19',
            type: 'Day 30'
          },
          {
            x: 12,
            y: 0.19929289460000002,
            originXData: '2022-03-20',
            type: 'Day 30'
          },
          {
            x: 13,
            y: 0.809589549,
            originXData: '2022-03-21',
            type: 'Day 30'
          },
          {
            x: 14,
            y: 1.4870099383,
            originXData: '2022-03-22',
            type: 'Day 30'
          },
          {
            x: 15,
            y: 0.6911503363,
            originXData: '2022-03-23',
            type: 'Day 30'
          },
          {
            x: 16,
            y: 0.9137728567000001,
            originXData: '2022-03-24',
            type: 'Day 30'
          },
          {
            x: 17,
            y: 0.2177407576,
            originXData: '2022-03-25',
            type: 'Day 30'
          },
          {
            x: 18,
            y: 0.6239129359000001,
            originXData: '2022-03-26',
            type: 'Day 30'
          },
          {
            x: 19,
            y: 0.8793789127,
            originXData: '2022-03-27',
            type: 'Day 30'
          },
          {
            x: 20,
            y: 3.6873272653,
            originXData: '2022-03-28',
            type: 'Day 30'
          },
          {
            x: 21,
            y: 1.5701681021,
            originXData: '2022-03-29',
            type: 'Day 30'
          },
          {
            x: 22,
            y: 2.0640119018,
            originXData: '2022-03-30',
            type: 'Day 30'
          },
          {
            x: 23,
            y: 0.2558816094,
            originXData: '2022-03-31',
            type: 'Day 30'
          },
          {
            x: 24,
            y: 0.28813938780000004,
            originXData: '2022-04-01',
            type: 'Day 30'
          },
          {
            x: 25,
            y: 0.7396874536,
            originXData: '2022-04-02',
            type: 'Day 30'
          },
          {
            x: 26,
            y: 0.5073302039,
            originXData: '2022-04-03',
            type: 'Day 30'
          },
          {
            x: 27,
            y: 1.1471756633,
            originXData: '2022-04-04',
            type: 'Day 30'
          },
          {
            x: 28,
            y: 0.5127652428,
            originXData: '2022-04-05',
            type: 'Day 30'
          },
          {
            x: 29,
            y: 3.1277747021,
            originXData: '2022-04-06',
            type: 'Day 30'
          },
          {
            x: 30,
            y: 0.992819274,
            originXData: '2022-04-07',
            type: 'Day 30'
          },
          {
            x: 31,
            y: 2.9899184029,
            originXData: '2022-04-08',
            type: 'Day 30'
          },
          {
            x: 32,
            y: 0.1848978212,
            originXData: '2022-04-09',
            type: 'Day 30'
          },
          {
            x: 33,
            y: 0.7730306505000001,
            originXData: '2022-04-10',
            type: 'Day 30'
          },
          {
            x: 34,
            y: 1.1143705228,
            originXData: '2022-04-11',
            type: 'Day 30'
          },
          {
            x: 35,
            y: 0.1353114548,
            originXData: '2022-04-12',
            type: 'Day 30'
          },
          {
            x: 36,
            y: 0.6722831761,
            originXData: '2022-04-13',
            type: 'Day 30'
          },
          {
            x: 37,
            y: 2.2087959429,
            originXData: '2022-04-14',
            type: 'Day 30'
          },
          {
            x: 38,
            y: 1.4864361411,
            originXData: '2022-04-15',
            type: 'Day 30'
          },
          {
            x: 39,
            y: 0.4476097283,
            originXData: '2022-04-16',
            type: 'Day 30'
          },
          {
            x: 40,
            y: 2.5019279171,
            originXData: '2022-04-17',
            type: 'Day 30'
          },
          {
            x: 41,
            y: 0.5390569336000001,
            originXData: '2022-04-18',
            type: 'Day 30'
          },
          {
            x: 42,
            y: 0.2887980584,
            originXData: '2022-04-19',
            type: 'Day 30'
          },
          {
            x: 43,
            y: 3.427701376,
            originXData: '2022-04-20',
            type: 'Day 30'
          },
          {
            x: 44,
            y: 0.188475623,
            originXData: '2022-04-21',
            type: 'Day 30'
          },
          {
            x: 45,
            y: 2.0316292018,
            originXData: '2022-04-22',
            type: 'Day 30'
          },
          {
            x: 46,
            y: 1.6085400627,
            originXData: '2022-04-23',
            type: 'Day 30'
          },
          {
            x: 47,
            y: 0.49291587130000003,
            originXData: '2022-04-24',
            type: 'Day 30'
          },
          {
            x: 48,
            y: 1.0758401553999999,
            originXData: '2022-04-25',
            type: 'Day 30'
          },
          {
            x: 49,
            y: 1.6932067561,
            originXData: '2022-04-26',
            type: 'Day 30'
          },
          {
            x: 50,
            y: 1.5178343208,
            originXData: '2022-04-27',
            type: 'Day 30'
          },
          {
            x: 51,
            y: 3.4810699891,
            originXData: '2022-04-28',
            type: 'Day 30'
          },
          {
            x: 52,
            y: 0.4272998243,
            originXData: '2022-04-29',
            type: 'Day 30'
          },
          {
            x: 53,
            y: 5.3984392306,
            originXData: '2022-04-30',
            type: 'Day 30'
          },
          {
            x: 54,
            y: 1.0756429336,
            originXData: '2022-05-01',
            type: 'Day 30'
          },
          {
            x: 55,
            y: 3.1671467195,
            originXData: '2022-05-02',
            type: 'Day 30'
          },
          {
            x: 56,
            y: 0.7959884081,
            originXData: '2022-05-03',
            type: 'Day 30'
          },
          {
            x: 57,
            y: 0.1020268037,
            originXData: '2022-05-04',
            type: 'Day 30'
          },
          {
            x: 58,
            y: 4.882028373,
            originXData: '2022-05-05',
            type: 'Day 30'
          },
          {
            x: 59,
            y: 0.8047403535000001,
            originXData: '2022-05-06',
            type: 'Day 30'
          },
          {
            x: 60,
            y: 0.4819440077,
            originXData: '2022-05-07',
            type: 'Day 30'
          },
          {
            x: 61,
            y: 4.9256519699,
            originXData: '2022-05-08',
            type: 'Day 30'
          },
          {
            x: 62,
            y: 11.5137995206,
            originXData: '2022-05-09',
            type: 'Day 30'
          },
          {
            x: 63,
            y: 3.2645929834,
            originXData: '2022-05-10',
            type: 'Day 30'
          },
          {
            x: 64,
            y: 0.1073885086,
            originXData: '2022-05-11',
            type: 'Day 30'
          },
          {
            x: 65,
            y: 0.332365238,
            originXData: '2022-05-12',
            type: 'Day 30'
          },
          {
            x: 66,
            y: 2.6046668798,
            originXData: '2022-05-13',
            type: 'Day 30'
          },
          {
            x: 67,
            y: 2.6538402794,
            originXData: '2022-05-14',
            type: 'Day 30'
          },
          {
            x: 68,
            y: 1.4015799425,
            originXData: '2022-05-15',
            type: 'Day 30'
          },
          {
            x: 69,
            y: 0.30314680250000003,
            originXData: '2022-05-16',
            type: 'Day 30'
          },
          {
            x: 70,
            y: 0.4262518671,
            originXData: '2022-05-17',
            type: 'Day 30'
          },
          {
            x: 71,
            y: 4.6815321988,
            originXData: '2022-05-18',
            type: 'Day 30'
          },
          {
            x: 72,
            y: 0.6335879494000001,
            originXData: '2022-05-19',
            type: 'Day 30'
          },
          {
            x: 73,
            y: 0.5602257547,
            originXData: '2022-05-20',
            type: 'Day 30'
          },
          {
            x: 74,
            y: 2.2887809386,
            originXData: '2022-05-21',
            type: 'Day 30'
          },
          {
            x: 75,
            y: 0.1014846205,
            originXData: '2022-05-22',
            type: 'Day 30'
          },
          {
            x: 76,
            y: 0.1317819308,
            originXData: '2022-05-23',
            type: 'Day 30'
          },
          {
            x: 77,
            y: 0.0816944438,
            originXData: '2022-05-24',
            type: 'Day 30'
          },
          {
            x: 78,
            y: 3.0789159673,
            originXData: '2022-05-25',
            type: 'Day 30'
          },
          {
            x: 79,
            y: 1.3669317817,
            originXData: '2022-05-26',
            type: 'Day 30'
          },
          {
            x: 80,
            y: 0.9816679261000001,
            originXData: '2022-05-27',
            type: 'Day 30'
          },
          {
            x: 81,
            y: 0.6666571925,
            originXData: '2022-05-28',
            type: 'Day 30'
          },
          {
            x: 82,
            y: 1.2124778516,
            originXData: '2022-05-29',
            type: 'Day 30'
          },
          {
            x: 83,
            y: 2.078742107,
            originXData: '2022-05-30',
            type: 'Day 30'
          },
          {
            x: 84,
            y: 0.44846266570000004,
            originXData: '2022-05-31',
            type: 'Day 30'
          },
          {
            x: 85,
            y: 0.3411358264,
            originXData: '2022-06-01',
            type: 'Day 30'
          },
          {
            x: 86,
            y: 1.2661919033,
            originXData: '2022-06-02',
            type: 'Day 30'
          },
          {
            x: 87,
            y: 2.4747460378,
            originXData: '2022-06-03',
            type: 'Day 30'
          },
          {
            x: 88,
            y: 1.1345556923,
            originXData: '2022-06-04',
            type: 'Day 30'
          },
          {
            x: 89,
            y: 1.5017989049,
            originXData: '2022-06-05',
            type: 'Day 30'
          },
          {
            x: 90,
            y: 1.1033475989000001,
            originXData: '2022-06-06',
            type: 'Day 30'
          },
          {
            x: 91,
            y: 1.7425581368,
            originXData: '2022-06-07',
            type: 'Day 30'
          },
          {
            x: 92,
            y: 0.7896205093,
            originXData: '2022-06-08',
            type: 'Day 30'
          },
          {
            x: 93,
            y: 0.0962218975,
            originXData: '2022-06-09',
            type: 'Day 30'
          },
          {
            x: 94,
            y: 0.6158606912,
            originXData: '2022-06-10',
            type: 'Day 30'
          },
          {
            x: 95,
            y: 3.9896176256,
            originXData: '2022-06-11',
            type: 'Day 30'
          },
          {
            x: 96,
            y: 0.4244306208,
            originXData: '2022-06-12',
            type: 'Day 30'
          },
          {
            x: 97,
            y: 0.2861138567,
            originXData: '2022-06-13',
            type: 'Day 30'
          },
          {
            x: 98,
            y: 0.2094180651,
            originXData: '2022-06-14',
            type: 'Day 30'
          },
          {
            x: 99,
            y: 2.1967339558,
            originXData: '2022-06-15',
            type: 'Day 30'
          },
          {
            x: 100,
            y: 1.2585401986,
            originXData: '2022-06-16',
            type: 'Day 30'
          },
          {
            x: 101,
            y: 2.6663567354,
            originXData: '2022-06-17',
            type: 'Day 30'
          },
          {
            x: 102,
            y: 9.2597366863,
            originXData: '2022-06-18',
            type: 'Day 30'
          },
          {
            x: 103,
            y: 0.5817093959,
            originXData: '2022-06-19',
            type: 'Day 30'
          },
          {
            x: 104,
            y: 0.43893132290000003,
            originXData: '2022-06-20',
            type: 'Day 30'
          },
          {
            x: 105,
            y: 0.7908232501,
            originXData: '2022-06-21',
            type: 'Day 30'
          },
          {
            x: 106,
            y: 0.2668289608,
            originXData: '2022-06-22',
            type: 'Day 30'
          },
          {
            x: 107,
            y: 0.6730935692000001,
            originXData: '2022-06-23',
            type: 'Day 30'
          },
          {
            x: 108,
            y: 3.0645024396,
            originXData: '2022-06-24',
            type: 'Day 30'
          },
          {
            x: 109,
            y: 20.5068991571,
            originXData: '2022-06-25',
            type: 'Day 30'
          },
          {
            x: 110,
            y: 0.0738780406,
            originXData: '2022-06-26',
            type: 'Day 30'
          },
          {
            x: 111,
            y: 0.4082404235,
            originXData: '2022-06-27',
            type: 'Day 30'
          },
          {
            x: 112,
            y: 1.9204493311,
            originXData: '2022-06-28',
            type: 'Day 30'
          },
          {
            x: 113,
            y: 0.3071713864,
            originXData: '2022-06-29',
            type: 'Day 30'
          },
          {
            x: 114,
            y: 0.16645440220000002,
            originXData: '2022-06-30',
            type: 'Day 30'
          },
          {
            x: 115,
            y: 3.1387063256,
            originXData: '2022-07-01',
            type: 'Day 30'
          },
          {
            x: 116,
            y: 0.9310154809000001,
            originXData: '2022-07-02',
            type: 'Day 30'
          },
          {
            x: 117,
            y: 6.0602543852,
            originXData: '2022-07-03',
            type: 'Day 30'
          },
          {
            x: 118,
            y: 1.4173228028,
            originXData: '2022-07-04',
            type: 'Day 30'
          },
          {
            x: 119,
            y: 1.1267813713,
            originXData: '2022-07-05',
            type: 'Day 30'
          },
          {
            x: 120,
            y: 0.7586253761,
            originXData: '2022-07-06',
            type: 'Day 30'
          },
          {
            x: 121,
            y: 0.3346065004,
            originXData: '2022-07-07',
            type: 'Day 30'
          },
          {
            x: 122,
            y: 2.1001157262,
            originXData: '2022-07-08',
            type: 'Day 30'
          },
          {
            x: 123,
            y: 1.098671066,
            originXData: '2022-07-09',
            type: 'Day 30'
          },
          {
            x: 124,
            y: 0.24821050300000003,
            originXData: '2022-07-10',
            type: 'Day 30'
          },
          {
            x: 125,
            y: 1.1625626943,
            originXData: '2022-07-11',
            type: 'Day 30'
          },
          {
            x: 126,
            y: 0.1647260813,
            originXData: '2022-07-12',
            type: 'Day 30'
          },
          {
            x: 127,
            y: 0.47535423330000004,
            originXData: '2022-07-13',
            type: 'Day 30'
          },
          {
            x: 128,
            y: 2.1630776134,
            originXData: '2022-07-14',
            type: 'Day 30'
          },
          {
            x: 129,
            y: 1.0634697664,
            originXData: '2022-07-15',
            type: 'Day 30'
          },
          {
            x: 130,
            y: 1.7968887169,
            originXData: '2022-07-16',
            type: 'Day 30'
          },
          {
            x: 131,
            y: 1.4355656083000001,
            originXData: '2022-07-17',
            type: 'Day 30'
          },
          {
            x: 132,
            y: 1.3079446457000001,
            originXData: '2022-07-18',
            type: 'Day 30'
          },
          {
            x: 133,
            y: 0.7078744681,
            originXData: '2022-07-19',
            type: 'Day 30'
          },
          {
            x: 134,
            y: 2.0352593685,
            originXData: '2022-07-20',
            type: 'Day 30'
          },
          {
            x: 135,
            y: 2.5708159393,
            originXData: '2022-07-21',
            type: 'Day 30'
          },
          {
            x: 136,
            y: 19.3840276712,
            originXData: '2022-07-22',
            type: 'Day 30'
          },
          {
            x: 137,
            y: 1.3897950918,
            originXData: '2022-07-23',
            type: 'Day 30'
          },
          {
            x: 138,
            y: 0.5621723470000001,
            originXData: '2022-07-24',
            type: 'Day 30'
          },
          {
            x: 139,
            y: 19.7299181151,
            originXData: '2022-07-25',
            type: 'Day 30'
          },
          {
            x: 140,
            y: 0.1128888247,
            originXData: '2022-07-26',
            type: 'Day 30'
          },
          {
            x: 141,
            y: 0.2696360186,
            originXData: '2022-07-27',
            type: 'Day 30'
          },
          {
            x: 142,
            y: 0.0251262069,
            originXData: '2022-07-28',
            type: 'Day 30'
          },
          {
            x: 143,
            y: 1.4941616822000001,
            originXData: '2022-07-29',
            type: 'Day 30'
          },
          {
            x: 144,
            y: 1.5683692587,
            originXData: '2022-07-30',
            type: 'Day 30'
          },
          {
            x: 145,
            y: 1.507293775,
            originXData: '2022-07-31',
            type: 'Day 30'
          },
          {
            x: 146,
            y: 1.5334817176,
            originXData: '2022-08-01',
            type: 'Day 30'
          },
          {
            x: 147,
            y: 0.0238485848,
            originXData: '2022-08-02',
            type: 'Day 30'
          },
          {
            x: 148,
            y: 1.3477512302,
            originXData: '2022-08-03',
            type: 'Day 30'
          },
          {
            x: 149,
            y: 1.3695465038,
            originXData: '2022-08-04',
            type: 'Day 30'
          },
          {
            x: 150,
            y: null,
            originXData: '2022-08-05',
            type: 'Day 30'
          },
          {
            x: 151,
            y: null,
            originXData: '2022-08-06',
            type: 'Day 30'
          },
          {
            x: 152,
            y: null,
            originXData: '2022-08-07',
            type: 'Day 30'
          },
          {
            x: 153,
            y: null,
            originXData: '2022-08-08',
            type: 'Day 30'
          },
          {
            x: 154,
            y: null,
            originXData: '2022-08-09',
            type: 'Day 30'
          },
          {
            x: 155,
            y: null,
            originXData: '2022-08-10',
            type: 'Day 30'
          },
          {
            x: 156,
            y: null,
            originXData: '2022-08-11',
            type: 'Day 30'
          },
          {
            x: 157,
            y: null,
            originXData: '2022-08-12',
            type: 'Day 30'
          },
          {
            x: 158,
            y: null,
            originXData: '2022-08-13',
            type: 'Day 30'
          },
          {
            x: 159,
            y: null,
            originXData: '2022-08-14',
            type: 'Day 30'
          },
          {
            x: 160,
            y: null,
            originXData: '2022-08-15',
            type: 'Day 30'
          },
          {
            x: 161,
            y: null,
            originXData: '2022-08-16',
            type: 'Day 30'
          },
          {
            x: 162,
            y: null,
            originXData: '2022-08-17',
            type: 'Day 30'
          },
          {
            x: 163,
            y: null,
            originXData: '2022-08-18',
            type: 'Day 30'
          },
          {
            x: 164,
            y: null,
            originXData: '2022-08-19',
            type: 'Day 30'
          },
          {
            x: 165,
            y: null,
            originXData: '2022-08-20',
            type: 'Day 30'
          },
          {
            x: 166,
            y: null,
            originXData: '2022-08-21',
            type: 'Day 30'
          },
          {
            x: 167,
            y: null,
            originXData: '2022-08-22',
            type: 'Day 30'
          },
          {
            x: 168,
            y: null,
            originXData: '2022-08-23',
            type: 'Day 30'
          },
          {
            x: 169,
            y: null,
            originXData: '2022-08-24',
            type: 'Day 30'
          },
          {
            x: 170,
            y: null,
            originXData: '2022-08-25',
            type: 'Day 30'
          },
          {
            x: 171,
            y: null,
            originXData: '2022-08-26',
            type: 'Day 30'
          },
          {
            x: 172,
            y: null,
            originXData: '2022-08-27',
            type: 'Day 30'
          },
          {
            x: 173,
            y: null,
            originXData: '2022-08-28',
            type: 'Day 30'
          },
          {
            x: 174,
            y: null,
            originXData: '2022-08-29',
            type: 'Day 30'
          },
          {
            x: 175,
            y: null,
            originXData: '2022-08-30',
            type: 'Day 30'
          },
          {
            x: 176,
            y: null,
            originXData: '2022-08-31',
            type: 'Day 30'
          },
          {
            x: 177,
            y: null,
            originXData: '2022-09-01',
            type: 'Day 30'
          },
          {
            x: 178,
            y: null,
            originXData: '2022-09-02',
            type: 'Day 30'
          }
        ]
      },
      xField: ['x'],
      yField: 'y',
      seriesField: 'type',
      label: {
        visible: false,
        style: {
          visible: false
        }
      },
      point: {
        zindex: 10,
        visible: false,
        style: {
          fill: '#66C5FF'
        }
      },
      invalidType: 'break',
      line: {
        zindex: 5,
        style: {
          stroke: '#66C5FF',
          lineWidth: 1
        }
      }
    },
    {
      id: 'New User Retentionseries3',
      regionId: 'New User Retention',
      type: 'line',
      data: {
        id: 'Day 90',
        values: [
          {
            x: 0,
            y: 0.5432085709,
            originXData: '2022-03-08',
            type: 'Day 90'
          },
          {
            x: 1,
            y: 1.2484376004,
            originXData: '2022-03-09',
            type: 'Day 90'
          },
          {
            x: 2,
            y: 0.9422320664,
            originXData: '2022-03-10',
            type: 'Day 90'
          },
          {
            x: 3,
            y: 0.0051602215,
            originXData: '2022-03-11',
            type: 'Day 90'
          },
          {
            x: 4,
            y: 0.712436217,
            originXData: '2022-03-12',
            type: 'Day 90'
          },
          {
            x: 5,
            y: 4.4000827018,
            originXData: '2022-03-13',
            type: 'Day 90'
          },
          {
            x: 6,
            y: 1.7840574293,
            originXData: '2022-03-14',
            type: 'Day 90'
          },
          {
            x: 7,
            y: 2.6068710031,
            originXData: '2022-03-15',
            type: 'Day 90'
          },
          {
            x: 8,
            y: 4.4099966947,
            originXData: '2022-03-16',
            type: 'Day 90'
          },
          {
            x: 9,
            y: 0.8131632753,
            originXData: '2022-03-17',
            type: 'Day 90'
          },
          {
            x: 10,
            y: 1.4676447379,
            originXData: '2022-03-18',
            type: 'Day 90'
          },
          {
            x: 11,
            y: 0.1914089783,
            originXData: '2022-03-19',
            type: 'Day 90'
          },
          {
            x: 12,
            y: 0.8329086323,
            originXData: '2022-03-20',
            type: 'Day 90'
          },
          {
            x: 13,
            y: 0.1011900723,
            originXData: '2022-03-21',
            type: 'Day 90'
          },
          {
            x: 14,
            y: 0.47899393710000004,
            originXData: '2022-03-22',
            type: 'Day 90'
          },
          {
            x: 15,
            y: 1.0324353868,
            originXData: '2022-03-23',
            type: 'Day 90'
          },
          {
            x: 16,
            y: 0.8581273960000001,
            originXData: '2022-03-24',
            type: 'Day 90'
          },
          {
            x: 17,
            y: 0.156662933,
            originXData: '2022-03-25',
            type: 'Day 90'
          },
          {
            x: 18,
            y: 1.1319818605,
            originXData: '2022-03-26',
            type: 'Day 90'
          },
          {
            x: 19,
            y: 0.193854928,
            originXData: '2022-03-27',
            type: 'Day 90'
          },
          {
            x: 20,
            y: 5.6092550871,
            originXData: '2022-03-28',
            type: 'Day 90'
          },
          {
            x: 21,
            y: 0.9736637522,
            originXData: '2022-03-29',
            type: 'Day 90'
          },
          {
            x: 22,
            y: 2.3991234266,
            originXData: '2022-03-30',
            type: 'Day 90'
          },
          {
            x: 23,
            y: 1.2948404447000001,
            originXData: '2022-03-31',
            type: 'Day 90'
          },
          {
            x: 24,
            y: 0.3108396886,
            originXData: '2022-04-01',
            type: 'Day 90'
          },
          {
            x: 25,
            y: 0.046799648400000005,
            originXData: '2022-04-02',
            type: 'Day 90'
          },
          {
            x: 26,
            y: 0.133445313,
            originXData: '2022-04-03',
            type: 'Day 90'
          },
          {
            x: 27,
            y: 0.6085234487,
            originXData: '2022-04-04',
            type: 'Day 90'
          },
          {
            x: 28,
            y: 1.8024448119,
            originXData: '2022-04-05',
            type: 'Day 90'
          },
          {
            x: 29,
            y: 2.125352223,
            originXData: '2022-04-06',
            type: 'Day 90'
          },
          {
            x: 30,
            y: 0.45486535650000004,
            originXData: '2022-04-07',
            type: 'Day 90'
          },
          {
            x: 31,
            y: 1.0069807945,
            originXData: '2022-04-08',
            type: 'Day 90'
          },
          {
            x: 32,
            y: 0.25443232920000003,
            originXData: '2022-04-09',
            type: 'Day 90'
          },
          {
            x: 33,
            y: 0.1289702758,
            originXData: '2022-04-10',
            type: 'Day 90'
          },
          {
            x: 34,
            y: 0.412638231,
            originXData: '2022-04-11',
            type: 'Day 90'
          },
          {
            x: 35,
            y: 0.2733742992,
            originXData: '2022-04-12',
            type: 'Day 90'
          },
          {
            x: 36,
            y: 2.451748873,
            originXData: '2022-04-13',
            type: 'Day 90'
          },
          {
            x: 37,
            y: 1.5493180812,
            originXData: '2022-04-14',
            type: 'Day 90'
          },
          {
            x: 38,
            y: 2.1384548042000002,
            originXData: '2022-04-15',
            type: 'Day 90'
          },
          {
            x: 39,
            y: 0.7130197984000001,
            originXData: '2022-04-16',
            type: 'Day 90'
          },
          {
            x: 40,
            y: 8.6368255089,
            originXData: '2022-04-17',
            type: 'Day 90'
          },
          {
            x: 41,
            y: 0.046639904600000004,
            originXData: '2022-04-18',
            type: 'Day 90'
          },
          {
            x: 42,
            y: 0.5037917157,
            originXData: '2022-04-19',
            type: 'Day 90'
          },
          {
            x: 43,
            y: 2.6774581256000003,
            originXData: '2022-04-20',
            type: 'Day 90'
          },
          {
            x: 44,
            y: 0.7405834557000001,
            originXData: '2022-04-21',
            type: 'Day 90'
          },
          {
            x: 45,
            y: 3.1436487140000002,
            originXData: '2022-04-22',
            type: 'Day 90'
          },
          {
            x: 46,
            y: 0.3803510961,
            originXData: '2022-04-23',
            type: 'Day 90'
          },
          {
            x: 47,
            y: 0.6796165301,
            originXData: '2022-04-24',
            type: 'Day 90'
          },
          {
            x: 48,
            y: 0.0567218956,
            originXData: '2022-04-25',
            type: 'Day 90'
          },
          {
            x: 49,
            y: 1.8808050325,
            originXData: '2022-04-26',
            type: 'Day 90'
          },
          {
            x: 50,
            y: 1.2433370077,
            originXData: '2022-04-27',
            type: 'Day 90'
          },
          {
            x: 51,
            y: 0.4331632427,
            originXData: '2022-04-28',
            type: 'Day 90'
          },
          {
            x: 52,
            y: 1.3168370189,
            originXData: '2022-04-29',
            type: 'Day 90'
          },
          {
            x: 53,
            y: 4.3434609624,
            originXData: '2022-04-30',
            type: 'Day 90'
          },
          {
            x: 54,
            y: 0.0264713687,
            originXData: '2022-05-01',
            type: 'Day 90'
          },
          {
            x: 55,
            y: 4.0808929673,
            originXData: '2022-05-02',
            type: 'Day 90'
          },
          {
            x: 56,
            y: 0.6088448789,
            originXData: '2022-05-03',
            type: 'Day 90'
          },
          {
            x: 57,
            y: 3.5191392133,
            originXData: '2022-05-04',
            type: 'Day 90'
          },
          {
            x: 58,
            y: 1.5019143338,
            originXData: '2022-05-05',
            type: 'Day 90'
          },
          {
            x: 59,
            y: 0.5585837278,
            originXData: '2022-05-06',
            type: 'Day 90'
          },
          {
            x: 60,
            y: 1.0537303113,
            originXData: '2022-05-07',
            type: 'Day 90'
          },
          {
            x: 61,
            y: 4.8917780855,
            originXData: '2022-05-08',
            type: 'Day 90'
          },
          {
            x: 62,
            y: 15.1559367716,
            originXData: '2022-05-09',
            type: 'Day 90'
          },
          {
            x: 63,
            y: 5.0680490761,
            originXData: '2022-05-10',
            type: 'Day 90'
          },
          {
            x: 64,
            y: 0.219539226,
            originXData: '2022-05-11',
            type: 'Day 90'
          },
          {
            x: 65,
            y: 0.7575560042,
            originXData: '2022-05-12',
            type: 'Day 90'
          },
          {
            x: 66,
            y: 1.5106870986,
            originXData: '2022-05-13',
            type: 'Day 90'
          },
          {
            x: 67,
            y: 3.5553011895999997,
            originXData: '2022-05-14',
            type: 'Day 90'
          },
          {
            x: 68,
            y: 1.0385911497,
            originXData: '2022-05-15',
            type: 'Day 90'
          },
          {
            x: 69,
            y: 1.3403690846,
            originXData: '2022-05-16',
            type: 'Day 90'
          },
          {
            x: 70,
            y: 0.5365236814000001,
            originXData: '2022-05-17',
            type: 'Day 90'
          },
          {
            x: 71,
            y: 3.9960531186,
            originXData: '2022-05-18',
            type: 'Day 90'
          },
          {
            x: 72,
            y: 0.3019139156,
            originXData: '2022-05-19',
            type: 'Day 90'
          },
          {
            x: 73,
            y: 0.37360311490000003,
            originXData: '2022-05-20',
            type: 'Day 90'
          },
          {
            x: 74,
            y: 0.5494982507,
            originXData: '2022-05-21',
            type: 'Day 90'
          },
          {
            x: 75,
            y: 0.1915614556,
            originXData: '2022-05-22',
            type: 'Day 90'
          },
          {
            x: 76,
            y: 1.1680026492,
            originXData: '2022-05-23',
            type: 'Day 90'
          },
          {
            x: 77,
            y: 1.8264769832,
            originXData: '2022-05-24',
            type: 'Day 90'
          },
          {
            x: 78,
            y: 1.3943591503000001,
            originXData: '2022-05-25',
            type: 'Day 90'
          },
          {
            x: 79,
            y: 0.6802362403000001,
            originXData: '2022-05-26',
            type: 'Day 90'
          },
          {
            x: 80,
            y: 1.1890899474,
            originXData: '2022-05-27',
            type: 'Day 90'
          },
          {
            x: 81,
            y: 0.5616115108,
            originXData: '2022-05-28',
            type: 'Day 90'
          },
          {
            x: 82,
            y: 0.9734085665000001,
            originXData: '2022-05-29',
            type: 'Day 90'
          },
          {
            x: 83,
            y: 2.1549943866,
            originXData: '2022-05-30',
            type: 'Day 90'
          },
          {
            x: 84,
            y: 1.5142804193,
            originXData: '2022-05-31',
            type: 'Day 90'
          },
          {
            x: 85,
            y: 0.2207806431,
            originXData: '2022-06-01',
            type: 'Day 90'
          },
          {
            x: 86,
            y: 1.2466960562,
            originXData: '2022-06-02',
            type: 'Day 90'
          },
          {
            x: 87,
            y: 0.7771142495000001,
            originXData: '2022-06-03',
            type: 'Day 90'
          },
          {
            x: 88,
            y: 1.1251228527000001,
            originXData: '2022-06-04',
            type: 'Day 90'
          },
          {
            x: 89,
            y: 0.3039983986,
            originXData: '2022-06-05',
            type: 'Day 90'
          },
          {
            x: 90,
            y: null,
            originXData: '2022-06-06',
            type: 'Day 90'
          },
          {
            x: 91,
            y: null,
            originXData: '2022-06-07',
            type: 'Day 90'
          },
          {
            x: 92,
            y: null,
            originXData: '2022-06-08',
            type: 'Day 90'
          },
          {
            x: 93,
            y: null,
            originXData: '2022-06-09',
            type: 'Day 90'
          },
          {
            x: 94,
            y: null,
            originXData: '2022-06-10',
            type: 'Day 90'
          },
          {
            x: 95,
            y: null,
            originXData: '2022-06-11',
            type: 'Day 90'
          },
          {
            x: 96,
            y: null,
            originXData: '2022-06-12',
            type: 'Day 90'
          },
          {
            x: 97,
            y: null,
            originXData: '2022-06-13',
            type: 'Day 90'
          },
          {
            x: 98,
            y: null,
            originXData: '2022-06-14',
            type: 'Day 90'
          },
          {
            x: 99,
            y: null,
            originXData: '2022-06-15',
            type: 'Day 90'
          },
          {
            x: 100,
            y: null,
            originXData: '2022-06-16',
            type: 'Day 90'
          },
          {
            x: 101,
            y: null,
            originXData: '2022-06-17',
            type: 'Day 90'
          },
          {
            x: 102,
            y: null,
            originXData: '2022-06-18',
            type: 'Day 90'
          },
          {
            x: 103,
            y: null,
            originXData: '2022-06-19',
            type: 'Day 90'
          },
          {
            x: 104,
            y: null,
            originXData: '2022-06-20',
            type: 'Day 90'
          },
          {
            x: 105,
            y: null,
            originXData: '2022-06-21',
            type: 'Day 90'
          },
          {
            x: 106,
            y: null,
            originXData: '2022-06-22',
            type: 'Day 90'
          },
          {
            x: 107,
            y: null,
            originXData: '2022-06-23',
            type: 'Day 90'
          },
          {
            x: 108,
            y: null,
            originXData: '2022-06-24',
            type: 'Day 90'
          },
          {
            x: 109,
            y: null,
            originXData: '2022-06-25',
            type: 'Day 90'
          },
          {
            x: 110,
            y: null,
            originXData: '2022-06-26',
            type: 'Day 90'
          },
          {
            x: 111,
            y: null,
            originXData: '2022-06-27',
            type: 'Day 90'
          },
          {
            x: 112,
            y: null,
            originXData: '2022-06-28',
            type: 'Day 90'
          },
          {
            x: 113,
            y: null,
            originXData: '2022-06-29',
            type: 'Day 90'
          },
          {
            x: 114,
            y: null,
            originXData: '2022-06-30',
            type: 'Day 90'
          },
          {
            x: 115,
            y: null,
            originXData: '2022-07-01',
            type: 'Day 90'
          },
          {
            x: 116,
            y: null,
            originXData: '2022-07-02',
            type: 'Day 90'
          },
          {
            x: 117,
            y: null,
            originXData: '2022-07-03',
            type: 'Day 90'
          },
          {
            x: 118,
            y: null,
            originXData: '2022-07-04',
            type: 'Day 90'
          },
          {
            x: 119,
            y: null,
            originXData: '2022-07-05',
            type: 'Day 90'
          },
          {
            x: 120,
            y: null,
            originXData: '2022-07-06',
            type: 'Day 90'
          },
          {
            x: 121,
            y: null,
            originXData: '2022-07-07',
            type: 'Day 90'
          },
          {
            x: 122,
            y: null,
            originXData: '2022-07-08',
            type: 'Day 90'
          },
          {
            x: 123,
            y: null,
            originXData: '2022-07-09',
            type: 'Day 90'
          },
          {
            x: 124,
            y: null,
            originXData: '2022-07-10',
            type: 'Day 90'
          },
          {
            x: 125,
            y: null,
            originXData: '2022-07-11',
            type: 'Day 90'
          },
          {
            x: 126,
            y: null,
            originXData: '2022-07-12',
            type: 'Day 90'
          },
          {
            x: 127,
            y: null,
            originXData: '2022-07-13',
            type: 'Day 90'
          },
          {
            x: 128,
            y: null,
            originXData: '2022-07-14',
            type: 'Day 90'
          },
          {
            x: 129,
            y: null,
            originXData: '2022-07-15',
            type: 'Day 90'
          },
          {
            x: 130,
            y: null,
            originXData: '2022-07-16',
            type: 'Day 90'
          },
          {
            x: 131,
            y: null,
            originXData: '2022-07-17',
            type: 'Day 90'
          },
          {
            x: 132,
            y: null,
            originXData: '2022-07-18',
            type: 'Day 90'
          },
          {
            x: 133,
            y: null,
            originXData: '2022-07-19',
            type: 'Day 90'
          },
          {
            x: 134,
            y: null,
            originXData: '2022-07-20',
            type: 'Day 90'
          },
          {
            x: 135,
            y: null,
            originXData: '2022-07-21',
            type: 'Day 90'
          },
          {
            x: 136,
            y: null,
            originXData: '2022-07-22',
            type: 'Day 90'
          },
          {
            x: 137,
            y: null,
            originXData: '2022-07-23',
            type: 'Day 90'
          },
          {
            x: 138,
            y: null,
            originXData: '2022-07-24',
            type: 'Day 90'
          },
          {
            x: 139,
            y: null,
            originXData: '2022-07-25',
            type: 'Day 90'
          },
          {
            x: 140,
            y: null,
            originXData: '2022-07-26',
            type: 'Day 90'
          },
          {
            x: 141,
            y: null,
            originXData: '2022-07-27',
            type: 'Day 90'
          },
          {
            x: 142,
            y: null,
            originXData: '2022-07-28',
            type: 'Day 90'
          },
          {
            x: 143,
            y: null,
            originXData: '2022-07-29',
            type: 'Day 90'
          },
          {
            x: 144,
            y: null,
            originXData: '2022-07-30',
            type: 'Day 90'
          },
          {
            x: 145,
            y: null,
            originXData: '2022-07-31',
            type: 'Day 90'
          },
          {
            x: 146,
            y: null,
            originXData: '2022-08-01',
            type: 'Day 90'
          },
          {
            x: 147,
            y: null,
            originXData: '2022-08-02',
            type: 'Day 90'
          },
          {
            x: 148,
            y: null,
            originXData: '2022-08-03',
            type: 'Day 90'
          },
          {
            x: 149,
            y: null,
            originXData: '2022-08-04',
            type: 'Day 90'
          },
          {
            x: 150,
            y: null,
            originXData: '2022-08-05',
            type: 'Day 90'
          },
          {
            x: 151,
            y: null,
            originXData: '2022-08-06',
            type: 'Day 90'
          },
          {
            x: 152,
            y: null,
            originXData: '2022-08-07',
            type: 'Day 90'
          },
          {
            x: 153,
            y: null,
            originXData: '2022-08-08',
            type: 'Day 90'
          },
          {
            x: 154,
            y: null,
            originXData: '2022-08-09',
            type: 'Day 90'
          },
          {
            x: 155,
            y: null,
            originXData: '2022-08-10',
            type: 'Day 90'
          },
          {
            x: 156,
            y: null,
            originXData: '2022-08-11',
            type: 'Day 90'
          },
          {
            x: 157,
            y: null,
            originXData: '2022-08-12',
            type: 'Day 90'
          },
          {
            x: 158,
            y: null,
            originXData: '2022-08-13',
            type: 'Day 90'
          },
          {
            x: 159,
            y: null,
            originXData: '2022-08-14',
            type: 'Day 90'
          },
          {
            x: 160,
            y: null,
            originXData: '2022-08-15',
            type: 'Day 90'
          },
          {
            x: 161,
            y: null,
            originXData: '2022-08-16',
            type: 'Day 90'
          },
          {
            x: 162,
            y: null,
            originXData: '2022-08-17',
            type: 'Day 90'
          },
          {
            x: 163,
            y: null,
            originXData: '2022-08-18',
            type: 'Day 90'
          },
          {
            x: 164,
            y: null,
            originXData: '2022-08-19',
            type: 'Day 90'
          },
          {
            x: 165,
            y: null,
            originXData: '2022-08-20',
            type: 'Day 90'
          },
          {
            x: 166,
            y: null,
            originXData: '2022-08-21',
            type: 'Day 90'
          },
          {
            x: 167,
            y: null,
            originXData: '2022-08-22',
            type: 'Day 90'
          },
          {
            x: 168,
            y: null,
            originXData: '2022-08-23',
            type: 'Day 90'
          },
          {
            x: 169,
            y: null,
            originXData: '2022-08-24',
            type: 'Day 90'
          },
          {
            x: 170,
            y: null,
            originXData: '2022-08-25',
            type: 'Day 90'
          },
          {
            x: 171,
            y: null,
            originXData: '2022-08-26',
            type: 'Day 90'
          },
          {
            x: 172,
            y: null,
            originXData: '2022-08-27',
            type: 'Day 90'
          },
          {
            x: 173,
            y: null,
            originXData: '2022-08-28',
            type: 'Day 90'
          },
          {
            x: 174,
            y: null,
            originXData: '2022-08-29',
            type: 'Day 90'
          },
          {
            x: 175,
            y: null,
            originXData: '2022-08-30',
            type: 'Day 90'
          },
          {
            x: 176,
            y: null,
            originXData: '2022-08-31',
            type: 'Day 90'
          },
          {
            x: 177,
            y: null,
            originXData: '2022-09-01',
            type: 'Day 90'
          },
          {
            x: 178,
            y: null,
            originXData: '2022-09-02',
            type: 'Day 90'
          }
        ]
      },
      xField: ['x'],
      yField: 'y',
      seriesField: 'type',
      label: {
        visible: false,
        style: {
          visible: false
        }
      },
      point: {
        zindex: 10,
        visible: false,
        style: {
          fill: '#FFD030'
        }
      },
      invalidType: 'break',
      line: {
        zindex: 5,
        style: {
          stroke: '#FFD030',
          lineWidth: 1
        }
      }
    }
  ],
  axes: [
    {
      id: 'New User Retentionleft',
      regionId: 'New User Retention',
      seriesId: [
        'New User Retentionseries0',
        'New User Retentionseries1',
        'New User Retentionseries2',
        'New User Retentionseries3'
      ],
      orient: 'left'
    },
    {
      id: 'New User Retentionbottom',
      regionId: ['New User Retention'],
      orient: 'bottom'
    }
  ],
  scrollBar: [
    {
      orient: 'bottom',
      start: 0,
      end: 0.4,
      visible: true,
      roamDrag: {
        rate: 0.01,
        reverse: true
      },
      roamZoom: {
        rate: 0.1,
        focus: true
      }
    }
  ],
  tooltip: {
    visible: true
  },
  crosshair: {
    gridZindex: 600,
    trigger: ['hover'],
    xField: {
      bindingAxesIndex: [1],
      line: {
        visible: true,
        type: 'line',
        style: {
          opacity: 0.8,
          size: 3,
          strokeDash: [5, 5]
        }
      },
      label: {
        visible: false
      }
    },
    yField: {
      line: {
        visible: false
      },
      label: {
        visible: false
      }
    }
  },
  legends: {
    padding: {
      top: 10
    },
    visible: true,
    orient: 'bottom',
    title: {
      visible: false
    },
    item: {
      visible: true,
      background: {
        style: {
          fill: 'transparent'
        }
      },
      icon: {
        state: {
          unSelected: {
            fill: 'gray'
          }
        }
      },
      label: {
        style: {
          fontSize: 10
        }
      }
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[scrollBar](link)
