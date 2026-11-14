'use client';
import * as React from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Accordion } from '@base-ui/react/accordion';
import styles from './horizontal.module.css';

const displayValueMap = {
  one: '一',
  two: '二',
  three: '三',
} as any;
// for CSS reasons it's easier to use vertical text (i.e. not horizontal writing
// mode like English) in combination with animated width using --panel-width
export default function App() {
  const [val, setVal] = React.useState(['one']);
  return (
    <div className={styles.Wrapper}>
      <div className={styles.Section}>
        <h2>Horizontal LTR</h2>
        <Accordion.Root
          className={styles.Root}
          aria-label="Uncontrolled Horizontal Accordion"
          multiple={false}
        >
          {['one', 'two', 'three'].map((value) => (
            <Accordion.Item className={styles.Item} key={value}>
              <Accordion.Header className={styles.Header}>
                <Accordion.Trigger className={styles.Trigger} data-value={value}>
                  <span className={styles.Label}>{displayValueMap[value]}</span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={styles.Panel}>
                <div className={styles.Content}>
                  <p>
                    老婆の話が完ると、下人は嘲（あざけ）るような声で念を押した。そうして、一足前
                    へ出ると、不意に、右の手を面皰から離して、老婆の襟上（えりがみ）をつかみながら、
                    こう云った。
                  </p>
                  <p>
                    「では、己が引剥（ひはぎ）をしようと恨むまいな。己もそうしなければ、饑死をす
                    る体なのだ。」
                  </p>
                  <p>
                    下人は、すばやく、老婆の着物を剥ぎとった。それから、足にしがみつこうとする老
                    婆を、手荒く屍骸の上へ蹴倒した。梯子の口までは、僅に五歩を数えるばかりである。
                    下人は、剥ぎとった桧肌色の着物をわきにかかえて、またたく間に急な梯子を夜の底へ
                    かけ下りた。
                  </p>
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>

      <div className={styles.Section} dir="rtl">
        <span>
          <h2>Horizontal RTL</h2>
          <p>one section must remain open</p>
        </span>
        <DirectionProvider direction="rtl">
          <Accordion.Root
            className={styles.Root}
            aria-label="Controlled Horizontal RTL Accordion"
            multiple={false}
            orientation="horizontal"
            value={val}
            onValueChange={(newValue: Accordion.Root.Props['value']) => {
              if (Array.isArray(newValue) && newValue.length > 0) {
                setVal(newValue);
              }
            }}
          >
            {['one', 'two', 'three'].map((value) => (
              <Accordion.Item className={styles.Item} key={value} value={value}>
                <Accordion.Header className={styles.Header}>
                  <Accordion.Trigger className={styles.Trigger} data-value={value}>
                    <span className={styles.Label}>{displayValueMap[value]}</span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className={styles.Panel} keepMounted={false}>
                  <div className={styles.Content}>
                    <p>
                      老婆の話が完ると、下人は嘲（あざけ）るような声で念を押した。そうして、一足前
                      へ出ると、不意に、右の手を面皰から離して、老婆の襟上（えりがみ）をつかみながら、
                      こう云った。
                    </p>
                    <p>
                      「では、己が引剥（ひはぎ）をしようと恨むまいな。己もそうしなければ、饑死をす
                      る体なのだ。」
                    </p>
                    <p>
                      下人は、すばやく、老婆の着物を剥ぎとった。それから、足にしがみつこうとする老
                      婆を、手荒く屍骸の上へ蹴倒した。梯子の口までは、僅に五歩を数えるばかりである。
                      下人は、剥ぎとった桧肌色の着物をわきにかかえて、またたく間に急な梯子を夜の底へ
                      かけ下りた。
                    </p>
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </DirectionProvider>
      </div>
    </div>
  );
}
