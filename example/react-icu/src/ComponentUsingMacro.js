import React from 'react';
import { withTranslation } from 'react-i18next';

// importing the macro components from react-i18next
import { Trans, Plural, Select } from 'react-i18next/icu.macro';

// as we "bend" some es-lint rules we need to disable those
// this let us write "{ trainersCount, number }" or "{ catchDate, date, short }"
// inside Trans -> other option would be an additional component which transforms
// to needed string, eg. <FormattedNumber count={count} />
/* eslint-disable no-undef, no-sequences */
// prettier-ignore
export function ComponentUsingMacro() {
  const name = 'John Doe';
  const itemsCount1 = 0;
  const itemsCount2 = 1;
  const itemsCount3 = 199;
  const trainersCount = 134567;

  const catchDate = new Date();
  const gender = 'female';


  return (
    <div>
      <hr />
      <p><i>Using babel macro plugin to transpile icu containing nodes into valid Trans component:</i></p>


      <p><i>interpolation:</i></p>
      <Trans>Welcome, { name }!</Trans>
      <br />
      <Trans>Welcome, <strong>{ name }</strong>!</Trans>
      <br />
      <Trans>Trainers: { trainersCount, number }</Trans>
      <br />
      <Trans>Trainers: <strong>{ trainersCount, number }</strong>!</Trans>
      <br />
      <Trans>Caught on { catchDate, date, full }</Trans>
      <br />
      <Trans>Caught on <strong>{ catchDate, date, full }</strong>!</Trans>

      <p><i>select:</i></p>
      <Select
        switch={gender}
        male="He avoids bugs."
        female="She avoids bugs."
        other="They avoid bugs."
      />
      <br />
      <Select
        switch={gender}
        male={<Trans><strong>He</strong> avoids bugs.</Trans>}
        female={<Trans><strong>She</strong> avoids bugs.</Trans>}
        other={<Trans><strong>They</strong> avoid bugs.</Trans>}
      />

      <p><i>plurals:</i></p>
      <Plural
        count={itemsCount1}
        $0="There is no item."
        one="There is # item."
        other="There are # items."
      />
      <br />
      <Plural
        count={itemsCount2}
        $0="There is no item."
        one="There is # item."
        other="There are # items."
      />
      <br />
      <Plural
        count={itemsCount3}
        $0="There is no item."
        one="There is # item."
        other="There are # items."
      />
      <br />
      <Plural
        i18nKey="testKey"
        count={itemsCount3}
        $0={<Trans>There is <strong>no</strong> item.</Trans>}
        one={<Trans>There is <strong>#</strong> item.</Trans>}
        other={<Trans>There are <strong>#</strong> items.</Trans>}
      />
    </div>
  );
}
/* eslint-enable no-undef, no-sequences */

export default withTranslation('translations')(ComponentUsingMacro);
