import SideMenu from '../../components/menu';
import DataTableComponent from '../../components/pod/main';

function Appmain() {
    return (
        <div id="appmain">
            <div className="grid">
                <div className="col-3">
                    <SideMenu />
                </div>

                <div className="col-9">
                  
                    <DataTableComponent />
                </div>
            </div>
        </div>
    );
}

export default Appmain
