import { CircleHelp } from 'lucide-react';
import { useLocationStore } from '../../stores/locationStore';
import { navigation } from './navigation';
export function WorkspaceHeading() {
 const screen = useLocationStore(s => s.appScreen);
 const page = navigation.find(item => item.id === screen)!;
 return <div className="workspace-heading"><div><p className="workspace-breadcrumb">{page.group}<span>/</span>{page.label}</p><h1>{page.title}</h1><p className="workspace-description">{page.description}</p></div><details key={screen} className="workspace-guide"><summary><CircleHelp size={17} /> How to use this</summary><ol>{page.steps.map(step => <li key={step}>{step}</li>)}</ol></details></div>;
}
