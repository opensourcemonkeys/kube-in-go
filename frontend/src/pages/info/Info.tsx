import './Info.css';
import { useT } from '../../i18n/useT';

function App() {
    const t = useT();
    return (
        <div id="Info">
            {t('panels:info.placeholder')}
        </div>
    )
}

export default App
