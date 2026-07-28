import { useNavigate } from "react-router-dom";
import { useState } from "react";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Dropdown from "@/components/dropdown";
import Button from "@/components/button";
import { LuUsers } from "react-icons/lu";
import { useCreate } from "@/services/useCrud";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function CreateUser() {
  const navigate = useNavigate();

  const createUserMutation = useCreate<{
    ErrorMessage: string;
    ErrorState: boolean;
  }>(["user-management"], "users/create", (data) => {
    if (data.ErrorState) {
      toast.error(data.ErrorMessage);
    } else {
      toast.success("User created successfully!");
      navigate("/user-management");
    }
  });

  const [formData, setFormData] = useState({
    firstname: "",
    middlename: "",
    lastname: "",
    email: "",
    contact: "",
    address: "",
    groups: [] as string[],
    department: "",
    site: "",
    username: "",
    password: "",
  });

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    setFormData((prev) => {
      if (checked) {
        // requestor, all_access, qfd_admin must be alone
        if (["requestor", "all_access", "qfd_admin"].includes(role)) {
          return { ...prev, groups: [role] };
        }
        // approver: remove solo roles if present
        if (role === "approver") {
          const filtered = prev.groups.filter(
            (r) => !["requestor", "all_access", "qfd_admin"].includes(r),
          );
          return {
            ...prev,
            groups: filtered.includes("approver")
              ? filtered
              : [...filtered, "approver"],
          };
        }
      }
      // uncheck
      return { ...prev, groups: prev.groups.filter((r) => r !== role) };
    });
  };

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
    { label: "WHD", value: "WHD" },
  ];

  const handleSubmit = () => {
    if (!formData.firstname || !formData.lastname) {
      toast.error("First name and last name are required!");
      return;
    }

    if (!formData.email) {
      toast.error("Email is required!");
      return;
    }

    if (!formData.username || !formData.password) {
      toast.error("Username and password are required!");
      return;
    }

    if (formData.groups.length === 0) {
      toast.error("Please select at least one role!");
      return;
    }

    const payload = {
      user_firstname: formData.firstname,
      user_middlename: formData.middlename,
      user_lastname: formData.lastname,
      user_email: formData.email,
      user_contact: formData.contact,
      user_address: formData.address,
      user_groups: formData.groups,
      user_department: formData.department,
      user_site: formData.site,
      user_username: formData.username,
      user_password: formData.password,
    };

    createUserMutation.mutate(payload);
  };

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuUsers className="text-2xl text-font-main" />}
        title="Create New User"
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
              label="First Name *"
              placeholder="Enter first name"
              value={formData.firstname}
              onChange={(e) => handleChange("firstname", e.target.value)}
            />
            <TextField
              variant="textFieldMain"
              label="Middle Name"
              placeholder="Enter middle name"
              value={formData.middlename}
              onChange={(e) => handleChange("middlename", e.target.value)}
            />
            <TextField
              variant="textFieldMain"
              label="Last Name *"
              placeholder="Enter last name"
              value={formData.lastname}
              onChange={(e) => handleChange("lastname", e.target.value)}
            />
            <TextField
              variant="textFieldMain"
              label="Email *"
              placeholder="Enter email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            <TextField
              variant="textFieldMain"
              label="Contact Number"
              placeholder="Enter contact number"
              value={formData.contact}
              onChange={(e) => handleChange("contact", e.target.value)}
            />
            <TextField
              variant="textFieldMain"
              label="Address"
              placeholder="Enter address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>
        </div>

        {/* Other Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Other Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            {/* Role Selection */}
            <div className="flex flex-col space-y-2 md:col-span-3">
              <Label>
                User Roles <span className="text-red-500">*</span>
              </Label>
              <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                {/* Requestor */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role-requestor"
                    checked={formData.groups.includes("requestor")}
                    onCheckedChange={(checked) =>
                      handleRoleChange("requestor", checked as boolean)
                    }
                  />
                  <label
                    htmlFor="role-requestor"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Requestor
                  </label>
                </div>

                {/* Approver */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role-approver"
                    checked={formData.groups.includes("approver")}
                    onCheckedChange={(checked) =>
                      handleRoleChange("approver", checked as boolean)
                    }
                    disabled={
                      formData.groups.includes("requestor") ||
                      formData.groups.includes("all_access") ||
                      formData.groups.includes("qfd_admin")
                    }
                  />
                  <label
                    htmlFor="role-approver"
                    className={`text-sm font-medium leading-none ${
                      formData.groups.includes("requestor") ||
                      formData.groups.includes("all_access") ||
                      formData.groups.includes("qfd_admin")
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    Approver
                  </label>
                </div>

                {/* All Access */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role-all-access"
                    checked={formData.groups.includes("all_access")}
                    onCheckedChange={(checked) =>
                      handleRoleChange("all_access", checked as boolean)
                    }
                  />
                  <label
                    htmlFor="role-all-access"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    All Access
                  </label>
                </div>

                {/* QFD Admin */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role-qfd-admin"
                    checked={formData.groups.includes("qfd_admin")}
                    onCheckedChange={(checked) =>
                      handleRoleChange("qfd_admin", checked as boolean)
                    }
                  />
                  <label
                    htmlFor="role-qfd-admin"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    QFD Admin
                  </label>
                </div>
              </div>

              {/* Helper text */}
              {formData.groups.includes("requestor") && (
                <p className="text-sm text-amber-600 mt-1">
                  ⚠️ Requestors cannot be combined with other roles.
                </p>
              )}
              {formData.groups.includes("all_access") && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ All Access users can access all modules.
                </p>
              )}
              {formData.groups.includes("qfd_admin") && (
                <p className="text-sm text-purple-600 mt-1">
                  ✓ QFD Admin users can access all modules.
                </p>
              )}
              {formData.groups.includes("approver") && (
                <p className="text-sm text-blue-600 mt-1">
                  ✓ This user can be assigned as an approver for specific forms.
                </p>
              )}
              {formData.groups.length === 0 && (
                <p className="text-sm text-red-600 mt-1">
                  Please select at least one role.
                </p>
              )}
            </div>

            <Dropdown
              variant="dropdownMain"
              label="Department"
              options={deptOptions}
              value={formData.department}
              onChange={(val) => handleChange("department", val)}
              placeholder="Select a department"
            />
            <Dropdown
              variant="dropdownMain"
              label="Site"
              options={siteOptions}
              value={formData.site}
              onChange={(val) => handleChange("site", val)}
              placeholder="Select a site"
            />
            <TextField
              variant="textFieldMain"
              label="Username *"
              placeholder="Enter username"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
            />
            <TextField
              variant="textFieldMain"
              label="Password *"
              placeholder="Enter password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            variant="buttonMain"
            onClick={handleSubmit}
            disabled={createUserMutation.isPending}
          >
            {createUserMutation.isPending ? "Creating..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
