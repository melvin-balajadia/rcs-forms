import { useNavigate } from "react-router-dom";
import { useState } from "react";
import PageHeader from "@/components/page-header";
import { LuUserPlus } from "react-icons/lu";
import TextField from "@/components/textfield";
import Dropdown from "@/components/dropdown";
import Button from "@/components/button";

export default function CreateClient() {
  const navigate = useNavigate();
  const [clientName, setClientName] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [site, setSite] = useState("");

  const handleGoBack = () => {
    navigate("/clients");
  };

  const handleSubmit = () => {
    console.log({ clientName, clientDescription, site });
  };

  const siteOptions = [
    { label: "Taytay", value: "taytay" },
    { label: "Marilao", value: "marilao" },
    { label: "Plaridel", value: "plaridel" },
    { label: "Cabuyao", value: "cabuyao" },
    { label: "Villasis", value: "villasis" },
  ];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuUserPlus className="text-2xl text-font-main" />}
        title="Create New Client"
        buttonText="Go Back"
        onButtonClick={handleGoBack}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div className="w-full">
            <TextField
              variant="textFieldMain"
              label="Client Name"
              placeholder="Enter client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="w-full">
            <TextField
              variant="textFieldMain"
              label="Client Description"
              placeholder="Enter client description"
              value={clientDescription}
              onChange={(e) => setClientDescription(e.target.value)}
            />
          </div>
          <div className="w-full pt-[6px]">
            <Dropdown
              label="Site"
              options={siteOptions}
              value={site}
              onChange={(value) => setSite(value)}
              placeholder="Select a site"
              variant="dropdownMain"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button variant="buttonMain" onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
