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
                    <h2 className="mb-3">Pod List</h2>
                    <DataTableComponent />
                </div>
            </div>
        </div>
    );
}

export default Appmain
