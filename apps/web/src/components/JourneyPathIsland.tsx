import { JourneyPathYaml, ResponsiveJourneyPath } from '@openuji/journey-path';
import type { ComponentProps, ReactElement } from 'react';
import filesharingYaml from '../assets/ujg/filesharing.ujg.yaml?raw';

type JourneyPathIslandProps = {
	accessibilityDocument?: unknown;
};

type JourneyPathYamlPropsWithAccessibility = ComponentProps<typeof JourneyPathYaml> & {
	accessibilityDocument?: unknown;
};

const JourneyPathYamlWithAccessibility = JourneyPathYaml as (
	props: JourneyPathYamlPropsWithAccessibility
) => ReactElement;

export default function JourneyPathIsland({ accessibilityDocument }: JourneyPathIslandProps) {
	return (<ResponsiveJourneyPath breakpoint={900}>
		<JourneyPathYamlWithAccessibility
			ariaLabel="Federated file sharing journey path"
			accessibilityDocument={accessibilityDocument}
			className="journey-path-island"
			source={filesharingYaml}
		/>
		</ResponsiveJourneyPath>
	);
}
