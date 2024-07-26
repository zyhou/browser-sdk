import type { FacetRegistry, FacetValuesFilter } from '../../../hooks/useEvents'
import type { Facet, FacetValue } from '../../../facets.constants'
type SelectionState = 'selected' | 'unselected' | 'partial-selected'

export function computeSelectionState(
  facetValuesFilter: FacetValuesFilter,
  facetRegistry: FacetRegistry,
  facet: Facet,
  facetValue: FacetValue
): SelectionState {
  const childrenFacets = getAllChildren(facet)
  // we cannot know how many children in total there are, so we need to have facetRegistry
  const children = childrenFacets.flatMap((child) => facetRegistry.getFacetChildrenValues(child.path))
  const filteredFacetValues = childrenFacets.flatMap((child) => facetValuesFilter.facetValues[child.path] ?? [])

  if (facetValuesFilter.type === 'include') {
    // if facet.value is in facetValueFilter, then it should be selected
    if (filteredFacetValues.includes(facetValue)) {
      return 'selected'
    }
    // if all children are in the filter, then it should be selected'
    if (children.every((child) => filteredFacetValues.includes(child))) {
      return 'selected'
    }
    // if any of the children of the facet is in the filter, then it should be partial-selected
    if (children.some((child) => filteredFacetValues.includes(child))) {
      return 'partial-selected'
    }

  } else if (facetValuesFilter.type === 'exclude') {
    // exclude mode
    // if facet.value is in facetValueFilter, then it should be unselected
    if (filteredFacetValues.includes(facetValue)) {
      return 'unselected'
    }
    // if all children are in the filter, then it should be unselected
    if (children.every((child) => filteredFacetValues.includes(child))) {
      return 'unselected'
    }
    // if any of the children of the facet is in the filter, then it should be partial-selected
    if (children.some((child) => filteredFacetValues.includes(child))) {
      return 'partial-selected'
    }
    return 'selected'
  }

  return 'unselected'

}

export const getAllChildren = (facet: Facet): Facet[] => {
  const children = facet.values ? Object.values(facet.values).flatMap((value) => value?.facets ?? []) : []
  return children.concat(children.flatMap(getAllChildren))
}
