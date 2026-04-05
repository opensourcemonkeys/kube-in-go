import { Component, useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import SideMenu from '../../components/menu';
import { GetPods } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import ListBoxComponent from '../../components/listbox';

function Appmain() {
    const [resultText, setResultText] = useState<[string, string][]>([]);
     const updateResultText = (result: [string, string][]) => setResultText(result);
    const navigate = useNavigate();
    const goInfo = () => {
        navigate("/info");
    };

    function greet() {
        let fetchedData: [string, string][] =[];
        GetPods().then((items:any)=>{
            
            items.forEach((element:any) => {
                let fetchedItem: [string, string]=["",""]
                console.log(element.name)
                fetchedItem[0]=element.name
                fetchedItem[1]=element.name
                fetchedData.push(fetchedItem)
                updateResultText(fetchedData)

            });
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
                    <ListBoxComponent data={resultText} ></ListBoxComponent>
                    <div className="text-center p-3 border-round-sm bg-primary font-bold">{resultText}</div>
                </div>
            </div>
        </div>
    )
}

export default Appmain
