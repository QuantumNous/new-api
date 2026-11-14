import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './i18n';
import { Trans } from '../src/Trans';

describe('trans using no children but components (object) - base case using array not object', () => {
  afterEach(() => {
    cleanup();
  });

  function TestComponent() {
    return (
      <Trans
        defaults="hello <0>beautiful</0> <1>{{what}}</1>"
        values={{ what: 'world' }}
        components={[<i>just dummy</i>, <strong>univers</strong>]}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <i>
          beautiful
        </i>
         
        <strong>
          world
        </strong>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - using index', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="hello <1>beautiful</1> <2>{{what}}</2>"
        values={{ what: 'world' }}
        components={{ 1: <i>just dummy</i>, 2: <strong>univers</strong> }}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <i>
          beautiful
        </i>
         
        <strong>
          world
        </strong>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - using names with less-than sign', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="hello <italic>under ten</italic><10 this text after the sign should be rendered <bold>{{what}}</bold>"
        values={{ what: 'world' }}
        components={{ italic: <i>just dummy</i>, bold: <strong>univers</strong> }}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <i>
          under ten
        </i>
        &lt;10 this text after the sign should be rendered 
        <strong>
          world
        </strong>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - using names', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="hello <italic>beautiful</italic> <bold>{{what}}</bold>"
        values={{ what: 'world' }}
        components={{ italic: <i>just dummy</i>, bold: <strong>univers</strong> }}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <i>
          beautiful
        </i>
         
        <strong>
          world
        </strong>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - using names with no lowercase', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="hello <italicCase>beautiful</italicCase> <BoldCase>{{what}}</BoldCase>"
        values={{ what: 'world' }}
        components={{ italicCase: <i>just dummy</i>, BoldCase: <strong>univers</strong> }}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <i>
          beautiful
        </i>
         
        <strong>
          world
        </strong>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - use more than once', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="hello<list><listitem>A</listitem>,<listitem>B</listitem>and<listitem>C</listitem></list>"
        components={{ list: <ul>a</ul>, listitem: <li>b</li> }}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello
        <ul>
          <li>
            A
          </li>
          ,
          <li>
            B
          </li>
          and
          <li>
            C
          </li>
        </ul>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - use more than once (empty)', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="hello<list><listitem>A</listitem>,<listitem>B</listitem>and<listitem>C</listitem></list>"
        components={{ list: <ul />, listitem: <li /> }}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello
        <ul>
          <li>
            A
          </li>
          ,
          <li>
            B
          </li>
          and
          <li>
            C
          </li>
        </ul>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - using self closing tag', () => {
  function Button() {
    return <button type="button">click me</button>;
  }
  function TestComponent() {
    return <Trans defaults="hello <ClickMe />" components={{ ClickMe: <Button /> }} />;
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <button
          type="button"
        >
          click me
        </button>
      </div>
    `);
  });
});

describe('trans using no children but components (object) - empty content', () => {
  function Button() {
    return <button type="button">click me</button>;
  }
  function TestComponent() {
    return <Trans defaults="hello <ClickMe></ClickMe>" components={{ ClickMe: <Button /> }} />;
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <button
          type="button"
        >
          click me
        </button>
      </div>
    `);
  });
});

describe('trans using children but components (object) - self closing tag', () => {
  function Button() {
    return <button type="button">click me</button>;
  }
  function TestComponent() {
    return <Trans components={{ ClickMe: <Button /> }}>{'hello <ClickMe/>'}</Trans>;
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <button
          type="button"
        >
          click me
        </button>
      </div>
    `);
  });
});

describe('trans using children and components (object) - should still allow for use of indexed basic html tags in children', () => {
  function TestComponent() {
    return (
      <Trans
        i18nKey="some key"
        defaults="Click <1>here</1> to continue"
        components={{ unused: <span /> }}
      >
        pre <a href="#">link</a> post
      </Trans>
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Click 
        <a
          href="#"
        >
          here
        </a>
         to continue
      </div>
    `);
  });
});

describe('trans using no children but components (object) - interpolated component with children', () => {
  function Button({ children }) {
    return <button type="button">{children}</button>;
  }
  function TestComponent() {
    return <Trans defaults="hello <ClickMe>Test</ClickMe>" components={{ ClickMe: <Button /> }} />;
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <button
          type="button"
        >
          Test
        </button>
      </div>
    `);
  });
});

describe('trans with multiple less-than signs', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="Values: <10, <20, and <bold>{{value}}</bold> are all less than 100"
        values={{ value: '50' }}
        components={{ bold: <strong>test</strong> }}
      />
    );
  }
  it('should render with escaped less-than signs', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Values: &lt;10, &lt;20, and 
        <strong>
          50
        </strong>
         are all less than 100
      </div>
    `);
  });
});

describe('trans with less-than in mathematical expression', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="If x<5 then <bold>do this</bold>"
        components={{ bold: <strong>test</strong> }}
      />
    );
  }
  it('should render with escaped less-than sign', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        If x&lt;5 then 
        <strong>
          do this
        </strong>
      </div>
    `);
  });
});

describe('trans with numbered tags with attributes', () => {
  function TestComponent() {
    return (
      <Trans
        defaults='Result should be a clickable link <0 href="https://www.google.com">Google</0>'
        components={[<a>dummy</a>]}
      />
    );
  }
  it('should render tags with attributes correctly', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Result should be a clickable link 
        <a
          href="https://www.google.com"
        >
          Google
        </a>
      </div>
    `);
  });
});

describe('trans with hyphenated component names', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="Visit our website: <website-link>mywebsite.fr</website-link>"
        components={{ 'website-link': <a href="https://mywebsite.fr">dummy</a> }}
      />
    );
  }
  it('should render hyphenated component names correctly', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Visit our website: 
        <a
          href="https://mywebsite.fr"
        >
          mywebsite.fr
        </a>
      </div>
    `);
  });
});

describe('trans with underscore component names', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="Click <my_button>here</my_button> to continue"
        components={{ my_button: <button type="button">dummy</button> }}
      />
    );
  }
  it('should render underscore component names correctly', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Click 
        <button
          type="button"
        >
          here
        </button>
         to continue
      </div>
    `);
  });
});
