import { JourneyPathYaml } from '@openuji/journey-path';
import filesharingYaml from '../assets/ujg/filesharing.ujg.yaml?raw';

export default function JourneyPathIsland() {
	return (
		<JourneyPathYaml
			ariaLabel="Federated file sharing journey path"
			className="journey-path-island"
			source={filesharingYaml}
		/>
	);
}
