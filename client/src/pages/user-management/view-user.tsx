import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Dropdown from "@/components/dropdown";
import Button from "@/components/button";
import { LuEye } from "react-icons/lu";
import { useFetch } from "@/services/useCrud";

export default function ViewUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: user,
    isLoading,
    isError,
  } = useFetch<any>(["user-management", id ?? ""], `/users/get/${id}`);

  if (!id) {
    return <div className="p-6 text-red-500">Invalid user ID.</div>;
  }

  if (isLoading) {
    return <div className="p-6">Loading user...</div>;
  }

  if (isError || !user) {
    return <div className="p-6 text-red-500">Failed to load user.</div>;
  }

  // ✅ API should return { ErrorState, ErrorMessage, data }
  const data = user.data || {};

  const siteOptions = [
    { label: "Taytay", value: "Taytay" },
    { label: "Marilao", value: "Marilao" },
    { label: "Plaridel", value: "Plaridel" },
    { label: "Cabuyao", value: "Cabuyao" },
    { label: "Villasis", value: "Villasis" },
  ];

  const deptOptions = [
    { label: "ITD", value: "ITD" },
    { label: "QFD", value: "QFD" },
  ];

  return (
    <div className="mx-6">
      <PageHeader
        icon={<LuEye className="text-2xl text-font-main" />}
        title="View User"
        buttonText="Go Back"
        onButtonClick={() => navigate("/user-management")}
        variant="default"
      />

      <div className="bg-white shadow-md p-6 rounded mt-4 space-y-8">
        {/* Personal Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <TextField
              variant="textFieldMain"
              label="First Name"
              value={data.user_firstname}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Middle Name"
              value={data.user_middlename}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Last Name"
              value={data.user_lastname}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Email"
              value={data.user_email}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Contact Number"
              value={data.user_contact}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Address"
              value={data.user_address}
              disabled
            />
          </div>
        </div>

        {/* Other Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Other Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <TextField
              variant="textFieldMain"
              label="Group/Policy"
              value={data.user_group}
              disabled
            />
            <Dropdown
              variant="dropdownMain"
              label="Department"
              options={deptOptions}
              value={data.user_department}
              disabled
            />
            <Dropdown
              variant="dropdownMain"
              label="Site"
              options={siteOptions}
              value={data.user_site}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Username"
              value={data.user_username}
              disabled
            />
            <TextField
              variant="textFieldMain"
              label="Password"
              type="password"
              value="********"
              disabled
            />
          </div>
        </div>

        {/* Back Button */}
        <div className="flex justify-end">
          <Button
            variant="buttonMain"
            onClick={() => navigate("/user-management")}
          >
            Back to List
          </Button>
        </div>
      </div>
    </div>
  );
}
