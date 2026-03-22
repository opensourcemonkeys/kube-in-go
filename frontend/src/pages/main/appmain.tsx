import {Component, useEffect, useState} from 'react';
import { useNavigate } from "react-router-dom";
import SideMenu from '../../components/menu';
import { Greet } from '../../../wailsjs/go/main/App';
import { models } from '../../../wailsjs/go/models';

function Appmain() {
    const [resultText, setResultText] = useState<models.PodInfo>();
    const updateResultText = (result: models.PodInfo) => setResultText(result);
    const navigate = useNavigate();
    const goInfo = () => {
        navigate("/info");
    };

    function greet() {
        Greet().then((result) => {
            result.forEach(res => {
                updateResultText(res)
            })
        });
    }

    useEffect(() => {
    greet()
  }, []);
    return (
        <div id="appmain">

        <div className="grid">
            <div className="col-3">
              <SideMenu></SideMenu>
            </div>
           
            <div className="col-9">
                <div className="text-center p-3 border-round-sm bg-primary font-bold">{resultText?.name}</div>
            </div>

        </div>
        </div>
    )
}

export default Appmain
