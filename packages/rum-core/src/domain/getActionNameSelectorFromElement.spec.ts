import { isIE } from '@datadog/browser-core'
import { appendElement } from '../../test'
import { getActionNameSelectorFromElement, supportScopeSelector } from './getActionNameSelectorFromElement'

describe('getActionNameSelectorFromElement', () => {
  beforeEach(() => {
    if (isIE()) {
      pending('IE not supported')
    }
  })
  afterEach(() => {
    document.body.classList.remove('foo')
  })

  describe('ID selector', () => {
    it('should use the ID selector when the element as an ID', () => {
      expect(getSelector('<div id="foo"></div>')).toBe('#foo')
    })

    it('should not use the ID selector when the ID is not unique', () => {
      expect(getSelector('<div id="foo"></div><div id="foo"></div>')).not.toContain('#foo')
    })

    it('should not use generated IDs', () => {
      expect(getSelector('<div id="foo4"></div>')).toBe('div')
    })
  })

  describe('class selector', () => {
    it('should use the class selector when the element as classes', () => {
      expect(getSelector('<div class="foo"></div>')).toBe('.foo')
    })

    // updated
    it('should use the class selector when siblings have the same classes but different semantic tags', () => {
      expect(getSelector('<article target class="foo"></article><span class="foo"></span>')).toBe('article.foo')
    })

    it('should not use the class selector when siblings have the same classes and non semantic tags', () => {
      expect(getSelector('<div target class="foo"></div><span class="foo"></span>')).not.toContain('.foo')
      expect(getSelector('<div target class="foo"></div><div class="foo"></div>')).not.toContain('.foo')
      expect(getSelector('<div target class="foo bar"></div><div class="bar foo baz"></div>')).not.toContain('.foo')
    })
    // end updated

    it('should not use the class selector for body elements', () => {
      document.body.classList.add('foo')
      expect(getSelector(document.body)).toBe('body')
    })

    it('should not use generated classes', () => {
      expect(getSelector('<div class="foo4"></div>')).toBe('div')
    })

    it('uses only the first class', () => {
      expect(getSelector('<div class="foo bar baz baa"></div>')).toBe('.foo')
    })
  })

  describe('position selector', () => {
    it('should use nth-of-type when the selector matches multiple descendants', () => {
      expect(
        getSelector(`
            <span></span>
            <div><button></button></div>
            <span></span>
            <div><button target></button></div>
          `)
      ).toBe('div:nth-of-type(2)>button')
    })

    it('should not use nth-of-type when the selector is matching a single descendant', () => {
      expect(
        getSelector(`
          <div></div>
          <div><button target></button></div>
        `)
      ).toBe('button')
    })

    it('should only consider direct descendants (>) of the parent element when checking for unicity', () => {
      expect(
        getSelector(`
          <main>
            <div><div><button></button></div></div>
            <div><button target></button></div>
          </main>
        `)
      ).toBe(
        supportScopeSelector()
          ? 'main>div>button'
          : // Degraded support for browsers not supporting scoped selector: the selector is still
            // correct, but its quality is a bit worse, as using a `nth-of-type` selector is a bit
            // too specific and might not match if an element is conditionally inserted before the
            // target.
            'main>div:nth-of-type(2)>button'
      )
    })
  })

  describe('strategies priority', () => {
    it('stable attribute should take precedence over class ID', () => {
      expect(getSelector('<div data-testid="foo" id="bar"></div>')).toBe('[data-testid="foo"]')
    })

    it('ID selector should take precedence over class selector', () => {
      expect(getSelector('<button id="foo" class="bar"></button>')).toBe('button#foo')
    })

    it('class selector should take precedence over position selector', () => {
      expect(getSelector('<div class="bar"></div><div></div>')).toBe('.bar')
    })
  })

  describe('should escape CSS selectors', () => {
    it('on ID value', () => {
      expect(getSelector('<div id="#bar"></div>')).toBe('#\\#bar')
    })

    it('on attribute value', () => {
      expect(getSelector('<div data-testid="&quot;foo bar&quot;"></div>')).toBe('[data-testid="\\"foo\\ bar\\""]')
    })

    it('on class name', () => {
      expect(getSelector('<div class="#bar"</div>')).toBe('.\\#bar')
    })

    it('on tag name', () => {
      expect(getSelector('<div&nbsp;span>></div&nbsp;span>')).toBe('div\\&nbsp\\;span')
    })
  })

  describe('attribute selector', () => {
    it('uses a stable attribute if the element has one', () => {
      expect(getSelector('<div data-testid="foo"></div>')).toBe('[data-testid="foo"]')
    })

    it('attribute selector with the custom action name attribute takes precedence over other stable attribute selectors', () => {
      expect(getSelector('<div action-name="foo" data-testid="bar"></div>', 'action-name')).toBe('[action-name="foo"]')
    })

    it('stable attribute selector should take precedence over class selector', () => {
      expect(getSelector('<div class="foo" data-testid="foo"></div>')).toBe('[data-testid="foo"]')
    })

    it('stable attribute selector should take precedence over ID selector', () => {
      expect(getSelector('<div id="foo" data-testid="foo"></div>')).toBe('[data-testid="foo"]')
    })

    it("uses a stable attribute selector and continue recursing if it's not unique globally", () => {
      expect(
        getSelector(`
            <button target data-testid="foo"></button>

            <div>
              <button data-testid="foo"></button>
            </div>
          `)
      ).toBe(
        supportScopeSelector()
          ? 'body>button[data-testid="foo"]'
          : // Degraded support for browsers not supporting scoped selector: the selector is still
            // correct, but its quality is a bit worse, as using a stable attribute reduce the
            // chances of matching a completely unrelated element.
            'body>button:nth-of-type(1)'
      )
    })
  })

  describe('should target closest atomic element', () => {
    it('based on their tags', () => {
      expect(getSelector('<button><span target><span></button>')).toBe('button')
      expect(getSelector('<a><span target><span></a>')).toBe('a')
      expect(getSelector('<select><option target><option></select>')).toBe('select')
    })

    it('based on their role', () => {
      expect(getSelector('<div role="link"><span target><span></a>')).toBe('div')
    })

    it('based on [aria-label]', () => {
      expect(getSelector('<div aria-label="foo"><span target><span></a>')).toBe('div')
    })

    it('based on [alt]', () => {
      expect(getSelector('<div  alt="foo"><span target><span></a>')).toBe('div')
    })

    it('based on [name]', () => {
      expect(getSelector('<div name="foo"><span target><span></a>')).toBe('div')
    })

    it('based on [title]', () => {
      expect(getSelector('<div title="foo"><span target><span></a>')).toBe('div')
    })
  })

  it('should stop recurring when uniq amongst the page atomic element', () => {
    expect(getSelector('<article><button target></button></article>')).toBe('button')
  })

  function getSelector(htmlOrElement: string | Element, actionNameAttribute?: string): string {
    return getActionNameSelectorFromElement(
      typeof htmlOrElement === 'string' ? appendElement(htmlOrElement) : htmlOrElement,
      actionNameAttribute
    )!
  }
})
