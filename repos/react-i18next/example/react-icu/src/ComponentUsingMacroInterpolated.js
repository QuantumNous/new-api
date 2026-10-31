import React from 'react';
import { withTranslation } from 'react-i18next';

// importing the macro components from react-i18next
import { Trans, plural, select, date, number } from 'react-i18next/icu.macro';

// with this syntax, we don't need to "bend" some es-lint rules, as we do inside ComponentUsingMacro
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
      <p>
        <i>
          Using babel macro plugin to transpile icu, using syntax like date`${'{'}varname{'}'}`:
        </i>
      </p>

      <p>
        <i>interpolation:</i>
      </p>
      <Trans>Welcome, {name}!</Trans>
      <br />
      <Trans>
        Welcome, <strong>{name}</strong>!
      </Trans>
      <br />
      <Trans>Trainers: {`number${trainersCount}`}</Trans>
      <br />
      <Trans>
        Trainers: <strong>{number`${trainersCount}`}</strong>!
      </Trans>
      <br />
      <Trans>Caught on {date`${catchDate}, full`}</Trans>
      <br />
      <Trans>
        Caught on <strong>{date`${catchDate}, full`}</strong>!
      </Trans>

      <p>
        <i>select:</i>
      </p>
      <Trans>{select`${gender}
       male {He avoids bugs.}
       female {She avoids bugs.}
       other {They avoid bugs.}
      `}</Trans>
      <br />
      <Trans>{select`${gender}
       male {${(<strong>He</strong>)} avoids bugs.}
       female {${(<strong>She</strong>)} avoids bugs.}
       other {${(<strong>They</strong>)} avoid bugs.}
      `}</Trans>
      <p>
        <i>plurals:</i>
      </p>
      <Trans>{plural`${itemsCount1},
        =0 {There is no item.}
        one {There is # item.}
        other {There are # items.}
      `}</Trans>
      <br />
      <Trans>{plural`${itemsCount2},
        =0 {There is no item.}
        one {There is # item.}
        other {There are # items.}
      `}</Trans>
      <br />
      <Trans>{plural`${itemsCount3},
        =0 {There is no item.}
        one {There is # item.}
        other {There are # items.}
      `}</Trans>
      <br />
      <Trans i18nKey="testKey">{plural`${itemsCount1},
        =0 {There is ${(<strong>no</strong>)} item.}
        one {There is ${(<strong>#</strong>)} item.}
        other {There are ${(<strong>#</strong>)} items.}
      `}</Trans>
    </div>
  );
}
/* eslint-enable no-undef, no-sequences */

export default withTranslation('translations')(ComponentUsingMacro);
