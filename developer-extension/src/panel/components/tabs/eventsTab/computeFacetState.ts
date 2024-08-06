import type { FacetRegistry, FacetValuesFilter } from '../../../hooks/useEvents'
import type { Facet, FacetValue } from '../../../facets.constants'
type SelectionState = 'selected' | 'unselected' | 'partial-selected'

export function computeSelectionState(
  facetValuesFilter: FacetValuesFilter,
  facetRegistry: FacetRegistry,
  facet: Facet,
  facetValue: FacetValue,
  parentList: string[]
): SelectionState {
  const childrenFacets = facet.values?.[facetValue]?.facets

  // we cannot know how many children in total there are, so we need to have facetRegistry
  const children = childrenFacets && childrenFacets.flatMap((child) => facetRegistry.getFacetChildrenValues(child.path))
  const filteredFacetValues = Object.values(facetValuesFilter.facetValues).flat()
  const ifFilterEmpty = Object.keys(facetValuesFilter.facetValues).length === 0

  if (facetValuesFilter.type === 'include') {
    if (ifFilterEmpty) {
      return 'unselected'
    }
    for (const parent of parentList) {
      if (filteredFacetValues.includes(parent)) {
        return 'selected'
      }
    }
    // if facet.value is in facetValueFilter, then it should be selected
    if (filteredFacetValues.includes(facetValue)) {
      return 'selected'
    }
    // if all children are in the filter, then it should be selected'
    if (children && children.every((child) => filteredFacetValues.includes(child))) {
      return 'selected'
    }
    // if any of the children of the facet is in the filter, then it should be partial-selected
    if (children && children.some((child) => filteredFacetValues.includes(child))) {
      return 'partial-selected'
    }
  } else if (facetValuesFilter.type === 'exclude') {
    if (ifFilterEmpty) {
      return 'selected'
    }
    // if facet.value is in facetValueFilter, then it should be unselected
    if (filteredFacetValues.includes(facetValue)) {
      return 'unselected'
    }
    // if all children are in the filter, then it should be unselected
    if (children && children.every((child) => filteredFacetValues.includes(child))) {
      return 'unselected'
    }
    // if any of the children of the facet is in the filter, then it should be partial-selected
    if (children && children.some((child) => filteredFacetValues.includes(child))) {
      return 'partial-selected'
    }
    return 'selected'
  }

  return 'unselected'
}
