
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type UjgNode = {
  "@id": string;
  "@type": string | string[];
  label?: string;
  [key: string]: unknown;
};

export type UjgDocument = {
  "@id": string;
  "@type": string;
  nodes: UjgNode[];
};


const ujgPath = resolve(
  import.meta.dirname,
  "../../apps/web/src/assets/ujg/filesharing.ujg.jsonld"
);


export function parseUjgDocument(source: string): UjgDocument {
  const parsed = JSON.parse(source) as UjgDocument;

  if (!Array.isArray(parsed.nodes)) {
    throw new Error("UJG document must contain a top-level nodes array");
  }

  return parsed;
}

export function loadFilesharingUjg(): UjgDocument {
  return parseUjgDocument(readFileSync(ujgPath, "utf8"));
}


export const compileHappyPathPlan = (document: UjgDocument) => {

    const journeysMap = document.nodes.filter(n => n['@type'] === 'Journey')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())

    const statesMap = document.nodes.filter(n => n['@type'] === 'State')
     .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    

    const touchpoints =  document.nodes.filter(n => n['@type'] === 'Touchpoint') 
    const touchpointsMap =  document.nodes.filter(n => n['@type'] === 'Touchpoint')
     .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
    const users = document.nodes.filter(n => n['@type'] === 'User')
    const usersMap = users.reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
    const usersCompositeStates = users.map(u => {
        return {...u, compositeStateRefs: u.touchpointRefs.flatMap(tRef => touchpointsMap.get(tRef).compositeStateRefs)}
    })
    const compositeStateUserMap = usersCompositeStates.reduce((agg, current) => {
        current.compositeStateRefs.forEach(ref => {
            agg.set(ref, current['@id'])
        });

        return agg
    }, new Map())

    const journeEntryIndex =  document.nodes.filter(n => n['@type'] === 'JourneyEntryIndex')
    const entryState = journeEntryIndex.reduce((agg, current) => ([...agg, ...current.stateRefs]), [])

    
    const compositeStates = document.nodes.filter(n => n['@type'] === 'CompositeState')
    const compositeStatesMap = compositeStates
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
    const buildCompositeStateTree = (compositeStateRefs, parentUser = null) => {
        
        return compositeStateRefs.map(ref => {
            const cs = compositeStatesMap.get(ref)  
            const user = parentUser || compositeStateUserMap.get(ref)        
            
            const journey = journeysMap.get(cs['subjourneyId']) 
            const journeyCS = journey.stateRefs.filter(ref => compositeStatesMap.has(ref))
            
            const s = {id: ref, user}
            if(journeyCS.length > 0) return {...s, childs: buildCompositeStateTree(journeyCS, user)}
            return s
            
        });

    }
     
    const compositeStateTree = buildCompositeStateTree(entryState)
    const flatCompositeStateTree = (tree, csMap = new Map()) => {
        tree.map((c) => {
            csMap.set(c.id, c)
            if(c.childs) flatCompositeStateTree(c.childs, csMap)
        })

        return csMap
    }

    const flatCS = flatCompositeStateTree(compositeStateTree)
    
    
    
    

    
    const phasesMap = document.nodes.filter(n => n['@type'] === 'Phase')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    const steps = document.nodes.filter(n => n['@type'] === 'Step')
    
    const journeyEntrysMap =  document.nodes.filter(n => n['@type'] === 'JourneyEntry')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())

    const transitionsMap = document.nodes.filter(n => n['@type'] === 'Transition')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
 
    const compositeStatesTransitions = compositeStates.reduce((agg, current) => {

        const compositeStateId = current['@id']
        const jorneyId = current['subjourneyId']
        
        const journey = journeysMap.get(jorneyId)
        const journeyTransitions = (journey.transitionRefs || []).map(t => transitionsMap.get(t))
        const journeyEnterStates = (journey.entryRefs || []).map(eRef =>journeyEntrysMap.get(eRef)).map((e) => statesMap.get(e.stateRef))
        const parentCS = Array.from(flatCS.entries()).find(([_, value]) => (value.childs || []).some(c => c.id === compositeStateId))
        const parentCompositeState = parentCS && parentCS[0] && compositeStatesMap.get(parentCS[0]) || undefined 
        
        agg.set(compositeStateId, {
            journeyTransitions,
            journeyEnterStates, 
            parentCompositeState 
        })

        return agg
        

    }, new Map())

    // const phaseSteps = steps.reduce((agg, current) => {
    //     const phaseId = current['phaseRef']
    //     const compositeStateId = current['compositeStateRef']
    //     if(!agg.has(phaseId)) {agg.set(phaseId, [])}
    //     const steps = agg.get(phaseId)

    //     const user = flatCS.get(compositeStateId).user
    //     const compositeJourney = compositeStatesTransitions.get(compositeStateId)
    //     agg.set(phaseId, [...steps, {...current, compositeJourney, user}])
    //     return agg
    // }, new Map())

    const buildStepPath = (compositeJourney, state, path = []) => {

        path.push(state)
        const transition = compositeJourney.journeyTransitions.find(t => t.from === state['@id'])
        if(transition) {
            const toState = statesMap.get(transition.to)
            
            
            if(toState) {
                path.push({...transition, kind: 'activation'})
                buildStepPath(compositeJourney, toState, path)
            }else {
                const parentCS = compositeJourney.parentCompositeState
                if(parentCS) {
                    const parentJourney = journeysMap.get(parentCS.subjourneyId);
                    const _transition =  (parentJourney.transitionRefs || []).map(ref => transitionsMap.get(ref)).find(t => t.fromExitRef === transition.to)
                    
                   if(_transition) {
                    path.push({...transition, parentTransitionRef: _transition['@id'], kind: 'parent-control-flow'})
                   }
                }                
            }            
        }
        
        return path;

    }



    const userTouchPointsSteps = steps.reduce((agg, current) => {
        const compositeStateId = current['compositeStateRef']
        const userId = flatCS.get(compositeStateId).user
        if(!agg.has(userId)) {
            agg.set(userId, new Map())
        }
        const userTouchPoints = agg.get(userId)
        const user = usersMap.get(userId)
        const touchPoint = touchpoints.find(t => user.touchpointRefs.includes(t['@id']))
        const touchPointId = touchPoint && touchPoint['@id']
        if(!touchPoint) return agg

        if(!userTouchPoints.has(touchPointId)) {
            userTouchPoints.set(touchPointId, [])
        }
        const steps = userTouchPoints.get(touchPointId)

        const compositeJourney = compositeStatesTransitions.get(compositeStateId)
        /** TODO: later we need to address this not only single entry */
        const enterState = compositeJourney.journeyEnterStates[0]

    
        const path = buildStepPath(compositeJourney, enterState)
        console.log('path', path)
        userTouchPoints.set(touchPointId, [...steps, {...current, compositeJourney, user, path}])
        return agg
    }, new Map())


    



    



}
