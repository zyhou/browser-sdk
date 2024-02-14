import { cssEscape } from '@datadog/browser-core'
import { STABLE_ATTRIBUTES } from './getSelectorFromElement'

export const nonSemanticTags = ['div', 'span']
const atomicComponentsSelectors = [
  [
    'button',
    'a',
    '[role=button]',
    '[role=link]',
    '[role=tab]',
    '[aria-label]',
    '[aria-labelledby]',
    '[alt]',
    '[name]',
    '[title]',
    '[placeholder]',
    'select',
  ],
]

type SelectorGetter = (element: Element, actionNameAttribute: string | undefined) => string | undefined

// Selectors to use if they target a single element among an element descendants. Those selectors
// are more brittle than "globally unique" selectors and should be combined with ancestor selectors
// to improve specificity.
const UNIQUE_SELECTOR_GETTERS: SelectorGetter[] = [
  getStableAttributeSelector,
  getIDSelector,
  getClassSelector,
  getTagNameSelector,
]
export function getActionNameSelectorFromElement(targetElement: Element, actionNameAttribute: string | undefined) {
  if (!targetElement.closest) {
    return
  }
  let targetElementSelector = ''
  let element: Element | null = targetElement

  const closestClickableElement = targetElement.closest(atomicComponentsSelectors.join(','))
  if (closestClickableElement) {
    element = closestClickableElement
  }

  while (element && element.nodeName !== 'HTML') {
    const uniqueSelectorAmongChildren = findSelector(
      element,
      UNIQUE_SELECTOR_GETTERS,
      isSelectorUniqueAmongSiblings,
      actionNameAttribute,
      targetElementSelector
    )

    targetElementSelector =
      uniqueSelectorAmongChildren || combineSelector(getPositionSelector(element), targetElementSelector)

    if (isSelectorUniqueGlobally(element, targetElementSelector)) {
      return targetElementSelector.toLowerCase()
    }

    element = element.parentElement
  }

  return targetElementSelector.toLowerCase()
}

function isGeneratedValue(value: string) {
  // To compute the "URL path group", the backend replaces every URL path parts as a question mark
  // if it thinks the part is an identifier. The condition it uses is to checks whether a digit is
  // present.
  //
  // Here, we use the same strategy: if a the value contains a digit, we consider it generated. This
  // strategy might be a bit naive and fail in some cases, but there are many fallbacks to generate
  // CSS selectors so it should be fine most of the time. We might want to allow customers to
  // provide their own `isGeneratedValue` at some point.
  return /[0-9]/.test(value)
}

function getIDSelector(element: Element): string | undefined {
  if (element.id && !isGeneratedValue(element.id)) {
    return `${semanticTagName(element)}#${cssEscape(element.id)}`
  }
}

function getClassSelector(element: Element): string | undefined {
  if (element.tagName === 'BODY') {
    return
  }
  if (element.classList.length > 0) {
    let cssSelector = ''
    let maxClassName = 1
    for (let i = 0; i < element.classList.length; i += 1) {
      if (maxClassName === 0) {
        break
      }
      const className = element.classList[i]
      if (isGeneratedValue(className)) {
        continue
      }

      cssSelector += `.${cssEscape(className)}`
      maxClassName -= 1
    }
    return `${semanticTagName(element)}${cssSelector}`
  }
}

function getTagNameSelector(element: Element): string {
  return `${cssEscape(element.tagName)}`
}

function getStableAttributeSelector(element: Element, actionNameAttribute: string | undefined): string | undefined {
  if (actionNameAttribute) {
    const selector = getAttributeSelector(element, actionNameAttribute)
    if (selector) {
      return selector
    }
  }

  for (const attributeName of STABLE_ATTRIBUTES) {
    const selector = getAttributeSelector(element, attributeName)
    if (selector) {
      return selector
    }
  }
}

function getAttributeSelector(element: Element, attributeName: string) {
  if (element.hasAttribute(attributeName)) {
    return `${semanticTagName(element)}[${attributeName}="${cssEscape(element.getAttribute(attributeName)!)}"]`
  }
}

function semanticTagName(element: Element) {
  return nonSemanticTags.indexOf(element.tagName.toLowerCase()) === -1 ? cssEscape(element.tagName) : ''
}

function getPositionSelector(element: Element): string {
  let sibling = element.parentElement!.firstElementChild
  let elementIndex = 1

  while (sibling && sibling !== element) {
    if (sibling.tagName === element.tagName) {
      elementIndex += 1
    }
    sibling = sibling.nextElementSibling
  }

  return `${element.tagName}:nth-of-type(${elementIndex})`
}

function findSelector(
  element: Element,
  selectorGetters: SelectorGetter[],
  predicate: (element: Element, selector: string) => boolean,
  actionNameAttribute: string | undefined,
  childSelector: string | undefined
) {
  let firstElementSelector = ''
  for (const selectorGetter of selectorGetters) {
    const elementSelector = selectorGetter(element, actionNameAttribute)
    if (!elementSelector) {
      continue
    }

    if (!firstElementSelector) {
      firstElementSelector = elementSelector
    }

    const fullSelector = combineSelector(elementSelector, childSelector)

    if (predicate(element, fullSelector)) {
      return fullSelector
    }
  }
}

/**
 * Check whether the selector is unique among the whole document.
 */
function isSelectorUniqueGlobally(element: Element, selector: string): boolean {
  return element.ownerDocument.querySelectorAll(selector).length === 1
}

/**
 * Check whether the selector is unique among the element siblings. In other words, it returns true
 * if "ELEMENT_PARENT > SELECTOR" returns a single element.
 *
 * The result will be less accurate on browsers that don't support :scope (i. e. IE): it will check
 * for any element matching the selector contained in the parent (in other words,
 * "ELEMENT_PARENT SELECTOR" returns a single element), regardless of whether the selector is a
 * direct descendent of the element parent. This should not impact results too much: if it
 * inaccurately returns false, we'll just fall back to another strategy.
 */
function isSelectorUniqueAmongSiblings(element: Element, selector: string): boolean {
  return (
    element.parentElement!.querySelectorAll(supportScopeSelector() ? combineSelector(':scope', selector) : selector)
      .length === 1
  )
}

function combineSelector(parent: string, child: string | undefined): string {
  return child ? `${parent}>${child}` : parent
}

let supportScopeSelectorCache: boolean | undefined
export function supportScopeSelector() {
  if (supportScopeSelectorCache === undefined) {
    try {
      document.querySelector(':scope')
      supportScopeSelectorCache = true
    } catch {
      supportScopeSelectorCache = false
    }
  }
  return supportScopeSelectorCache
}
