import { useNavigate } from "react-router-dom";
import { useState } from "react";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Dropdown from "@/components/dropdown";
import Button from "@/components/button";
import { LuMapPinHouse } from "react-icons/lu";
import { useCreate } from "@/services/useCrud";

export default function CreateRoom() {
  const navigate = useNavigate();
  const [clientName, setClientName] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [location, setLocation] = useState("");
  const [site, setSite] = useState("");

  // useCreate hook for rooms
  const createRoomMutation = useCreate<{ message: string }>(
    ["rooms"], // query key
    "/rooms/create", // endpoint
    () => {
      alert("Room created successfully!");
      navigate("/rooms");
    },
  );

  const handleSubmit = () => {
    if (!clientName || !clientDescription || !location || !site) {
      alert("Please fill out all fields.");
      return;
    }

    createRoomMutation.mutate({
      room_name: clientName,
      room_description: clientDescription,
      room_location: location,
      room_site: site,
    });
  };

  const siteOptions = [
    { label: "Taytay", value: "taytay" },
    { label: "Marilao", value: "marilao" },
    { label: "Plaridel", value: "plaridel" },
    { label: "Cabuyao", value: "cabuyao" },
    { label: "Villasis", value: "villasis" },
  ];

  const locationOptions = [
    { label: "Annex", value: "annex" },
    { label: "Main", value: "main" },
    { label: "Dry", value: "dry" },
  ];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuMapPinHouse className="text-2xl text-font-main" />}
        title="Create New Room"
        buttonText="Go Back"
        onButtonClick={() => navigate("/rooms")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6 items-start">
          <TextField
            variant="textFieldMain"
            label="Room Name"
            placeholder="Enter room name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />

          <TextField
            variant="textFieldMain"
            label="Room Description"
            placeholder="Enter room description"
            value={clientDescription}
            onChange={(e) => setClientDescription(e.target.value)}
          />

          <Dropdown
            variant="dropdownMain"
            label="Location"
            options={locationOptions}
            value={location}
            onChange={setLocation}
            placeholder="Select a Location"
          />

          <Dropdown
            variant="dropdownMain"
            label="Site"
            options={siteOptions}
            value={site}
            onChange={setSite}
            placeholder="Select a Site"
          />
        </div>

        <div className="flex justify-end mt-6">
          <Button
            variant="buttonMain"
            onClick={handleSubmit}
            disabled={createRoomMutation.isPending}
          >
            {createRoomMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
