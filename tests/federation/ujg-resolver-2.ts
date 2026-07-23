
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveStatePresenceTarget,
  resolveTransitionActivationTarget,
  type ResolvedStatePresenceTarget,
  type ResolvedTransitionActivationTarget
} from "./ujg-resolver.js";

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

type AnyNode = UjgNode & Record<string, any>;
type HappyPathPlanItemBase = {
  userId: string;
  touchpointId: string;
  phaseId: string;
  stepId: string;
};
export type HappyPathPlanItem =
  | (HappyPathPlanItemBase & { kind: "state"; target: ResolvedStatePresenceTarget })
  | (HappyPathPlanItemBase & {
      kind: "transition";
      target: ResolvedTransitionActivationTarget;
    })
  | (HappyPathPlanItemBase & { kind: "control-flow"; transitionId: string });
export type HappyPathPlan = { items: HappyPathPlanItem[] };

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


export const compileHappyPathPlan = (document: UjgDocument): HappyPathPlan => {
    const nodes = document.nodes as AnyNode[]

    const journeysMap = nodes.filter(n => n['@type'] === 'Journey')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())

    const statesMap = nodes.filter(n => n['@type'] === 'State')
     .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    

    const touchpoints =  nodes.filter(n => n['@type'] === 'Touchpoint') 
    const touchpointsMap =  nodes.filter(n => n['@type'] === 'Touchpoint')
     .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
    const users = nodes.filter(n => n['@type'] === 'User')
    const usersMap = users.reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
    const usersCompositeStates = users.map(u => {
        return {...u, compositeStateRefs: u.touchpointRefs.flatMap((tRef: string) => touchpointsMap.get(tRef).compositeStateRefs)}
    })
    const compositeStateUserMap = usersCompositeStates.reduce((agg, current) => {
        current.compositeStateRefs.forEach((ref: string) => {
            agg.set(ref, current['@id'])
        });

        return agg
    }, new Map())

    const journeEntryIndex =  nodes.filter(n => n['@type'] === 'JourneyEntryIndex')
    const entryState = journeEntryIndex.flatMap(current => current.stateRefs || [])

    
    const compositeStates = nodes.filter(n => n['@type'] === 'CompositeState')
    const compositeStatesMap = compositeStates
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
    const buildCompositeStateTree = (compositeStateRefs: string[], parentUser: string | null = null): any[] => {
        
        return compositeStateRefs.map(ref => {
            const cs = compositeStatesMap.get(ref)  
            const user = parentUser || compositeStateUserMap.get(ref)        
            
            const journey = journeysMap.get(cs['subjourneyId']) 
            const journeyCS = journey.stateRefs.filter((ref: string) => compositeStatesMap.has(ref))
            
            const s = {id: ref, user}
            if(journeyCS.length > 0) return {...s, childs: buildCompositeStateTree(journeyCS, user)}
            return s
            
        });

    }
     
    const compositeStateTree = buildCompositeStateTree(entryState)
    const flatCompositeStateTree = (tree: any[], csMap = new Map()) => {
        tree.map((c) => {
            csMap.set(c.id, c)
            if(c.childs) flatCompositeStateTree(c.childs, csMap)
        })

        return csMap
    }

    const flatCS = flatCompositeStateTree(compositeStateTree)
    
    
    
    

    
    const phasesMap = nodes.filter(n => n['@type'] === 'Phase')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    const steps = nodes.filter(n => n['@type'] === 'Step')
    
    const journeyEntrysMap =  nodes.filter(n => n['@type'] === 'JourneyEntry')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())

    const transitionsMap = nodes.filter(n => n['@type'] === 'Transition')
        .reduce((agg, current) => agg.set(current['@id'], current), new Map())
    
 
    const compositeStatesTransitions = compositeStates.reduce((agg, current) => {

        const compositeStateId = current['@id']
        const jorneyId = current['subjourneyId']
        
        const journey = journeysMap.get(jorneyId)
        const journeyTransitions = (journey.transitionRefs || []).map((t: string) => transitionsMap.get(t))
        const journeyEnterStates = (journey.entryRefs || []).map((eRef: string) =>journeyEntrysMap.get(eRef)).map((e: AnyNode) => statesMap.get(e.stateRef))
        const parentCS = Array.from(flatCS.entries()).find(([_, value]) => (value.childs || []).some((c: any) => c.id === compositeStateId))
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

    const buildStepPath = (compositeJourney: any, state: AnyNode, path: AnyNode[] = []) => {

        path.push({...state, kind: 'state'})
        const transition = compositeJourney.journeyTransitions.find((t: AnyNode) => t.from === state['@id'])
        if(transition) {
            path.push({...transition, kind: 'activation'})
            const toState = statesMap.get(transition.to)
            
            
            if(toState) {
                buildStepPath(compositeJourney, toState, path)
            }else {
                const parentCS = compositeJourney.parentCompositeState
                if(parentCS) {
                    const parentJourney = journeysMap.get(parentCS.subjourneyId);
                    const _transition =  (parentJourney.transitionRefs || []).map((ref: string) => transitionsMap.get(ref)).find((t: AnyNode) => t.fromExitRef === transition.to)
                    
                   if(_transition) {
                    path.push({..._transition, kind: 'parent-control-flow'})
                   }
                }                
            }            
        }
        
        return path;

    }



    const sourceOrder = new Map(nodes.map((node, index) => [node["@id"], index]))
    const order = (node: AnyNode | undefined, fallback: number) =>
      typeof node?.order === "number" ? node.order : fallback
    const eventIdForTransition = (transitionId: string) => {
      const surface = nodes.find(n => n["@type"] === "Surface" && n.graphNodeRef === transitionId)
      const binding = nodes.find(n =>
        n["@type"] === "ObservationBinding" && n.observeSurfaceRef === surface?.["@id"]
      )
      if (!binding?.observationEventRef) throw new Error(`Missing activation binding for ${transitionId}`)
      return binding.observationEventRef
    }
    const toItem = (meta: HappyPathPlanItemBase) => (node: AnyNode): HappyPathPlanItem => {
      if (node.kind === "state") return {...meta, kind: "state", target: resolveStatePresenceTarget(document, node["@id"])}
      if (node.kind === "activation") return {...meta, kind: "transition", target: resolveTransitionActivationTarget(document, node["@id"], eventIdForTransition(node["@id"]))}
      return {...meta, kind: "control-flow", transitionId: node["@id"]}
    }

    return {
      items: [...steps].sort((a, b) =>
        order(phasesMap.get(a.phaseRef), sourceOrder.get(a.phaseRef) ?? 0) -
          order(phasesMap.get(b.phaseRef), sourceOrder.get(b.phaseRef) ?? 0) ||
        order(a, sourceOrder.get(a["@id"]) ?? 0) - order(b, sourceOrder.get(b["@id"]) ?? 0)
      ).flatMap(step => {
        const compositeStateId = step.compositeStateRef
        const userId = flatCS.get(compositeStateId).user
        const user = usersMap.get(userId)
        const touchPoint = touchpoints.find(t => user.touchpointRefs.includes(t["@id"]))
        if (!touchPoint) throw new Error(`Missing touchpoint for ${userId}`)
        const compositeJourney = compositeStatesTransitions.get(compositeStateId)
        const path = buildStepPath(compositeJourney, compositeJourney.journeyEnterStates[0])
        return path.map(toItem({
          userId,
          touchpointId: touchPoint["@id"],
          phaseId: step.phaseRef,
          stepId: step["@id"]
        }))
      })
    }

    



    



}
