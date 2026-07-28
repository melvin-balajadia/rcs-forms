import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Dropdown from "@/components/dropdown";
import Button from "@/components/button";
import { LuUsers } from "react-icons/lu";
import { useUpdate, useFetch } from "@/services/useCrud";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPut } from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type FormApproval = {
  form_id: number;
  form_name: string;
  form_description: string;
  assignments: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
};

type FormApprovalsResponse = {
  user: {
    id: number;
    name: string;
    roles: string[];
  };
  forms: FormApproval[];
};

export default function EditUser() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const {
    data: userResponse,
    isLoading: isLoadingUser,
    isError: isErrorUser,
  } = id
    ? useFetch<any>(["user", id], `/users/get/${id}`)
    : { data: null, isLoading: false, isError: false };

  const updateUserMutation = useUpdate<{
    ErrorMessage: string;
    ErrorState: boolean;
  }>(["user-management"], `/users/edit/${id}`, (data) => {
    if (data.ErrorState) {
      toast.error("Validation error", {
        description: data.ErrorMessage,
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
    } else {
      toast.success("User updated successfully!", {
        description: "Redirecting...",
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
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
  });

  const [formApprovals, setFormApprovals] = useState<FormApproval[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (userResponse?.data) {
      const u = userResponse.data;
      setFormData({
        firstname: u.user_firstname || "",
        middlename: u.user_middlename || "",
        lastname: u.user_lastname || "",
        email: u.user_email || "",
        contact: u.user_contact || "",
        address: u.user_address || "",
        groups: Array.isArray(u.user_groups) ? u.user_groups : [],
        department: u.user_department || "",
        site: u.user_site || "",
        username: u.user_username || "",
      });
    }
  }, [userResponse]);

  const {
    data: formApprovalsData,
    isLoading: isLoadingApprovals,
    refetch: refetchApprovals,
  } = useQuery({
    queryKey: ["form-approvals", id],
    queryFn: async () => {
      if (!id) throw new Error("No user ID");
      const response = await apiGet(`/form-approvers/user/${id}`);
      return response as FormApprovalsResponse;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (formApprovalsData?.forms) {
      setFormApprovals(formApprovalsData.forms);
    }
  }, [formApprovalsData]);

  const saveApprovalsMutation = useMutation({
    mutationFn: async (assignments: any[]) => {
      return await apiPut(`/form-approvers/user/${id}`, { assignments });
    },
    onSuccess: () => {
      toast.success("Form approvals updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["form-approvals", id] });
      refetchApprovals();
    },
    onError: (error: any) => {
      toast.error("Error updating form approvals", {
        description: error?.message || "Something went wrong",
      });
    },
  });

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const DEFAULT_RESET_PASSWORD = "P@ssword1";

  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState(
    DEFAULT_RESET_PASSWORD,
  );

  const resetPasswordMutation = useUpdate<{
    ErrorMessage: string;
    ErrorState: boolean;
  }>(["user-management"], `/users/reset-password/${id}`, (data) => {
    if (data.ErrorState) {
      toast.error("Error resetting password", {
        description: data.ErrorMessage,
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
    } else {
      toast.success("Password reset successfully!", {
        description: "The user must change it on next login.",
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
      setIsResetPasswordOpen(false);
    }
  });

  const handleOpenResetPassword = () => {
    setResetPasswordValue(DEFAULT_RESET_PASSWORD);
    setIsResetPasswordOpen(true);
  };

  const handleSubmitResetPassword = () => {
    resetPasswordMutation.mutate({ password: resetPasswordValue });
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

  const handleApprovalChange = (formId: number, level: string) => {
    setFormApprovals((prev) =>
      prev.map((form) => {
        if (form.form_id === formId) {
          const newAssignments = { ...form.assignments };

          if (level === "none") {
            newAssignments.first = false;
            newAssignments.second = false;
            newAssignments.third = false;
          } else {
            const levelKey = level as "first" | "second" | "third";
            newAssignments[levelKey] = !newAssignments[levelKey];
          }

          return { ...form, assignments: newAssignments };
        }
        return form;
      }),
    );
  };

  const handleSaveApprovals = () => {
    const assignments = formApprovals
      .map((form) => {
        const levels: string[] = [];
        if (form.assignments.first) levels.push("first");
        if (form.assignments.second) levels.push("second");
        if (form.assignments.third) levels.push("third");

        if (levels.length > 0) {
          return { form_id: form.form_id, levels };
        }
        return null;
      })
      .filter((assignment) => assignment !== null);

    saveApprovalsMutation.mutate(assignments);
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

    if (!formData.username) {
      toast.error("Username is required!");
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
    };

    updateUserMutation.mutate(payload);
  };

  if (!id) return <p className="p-6 text-red-500">Invalid user ID.</p>;
  if (isLoadingUser) return <p className="p-6">Loading user data...</p>;
  if (isErrorUser)
    return <p className="p-6 text-red-500">Failed to fetch user.</p>;

  // ✅ all_access and qfd_admin can also manage approvals
  const hasApproverRole =
    formData.groups.includes("approver") ||
    formData.groups.includes("all_access") ||
    formData.groups.includes("qfd_admin");

  const filteredForms = formApprovals.filter((form) =>
    form.form_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuUsers className="text-2xl text-font-main" />}
        title="Edit User"
        buttonText="Go Back"
        onButtonClick={() => navigate("/user-management")}
        variant="default"
      />

      <Tabs defaultValue="personal" className="mt-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="personal">Personal Information</TabsTrigger>
          <TabsTrigger value="approvals">Form Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <div className="bg-white shadow-md p-6 rounded space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                <TextField
                  variant="textFieldMain"
                  label="First Name *"
                  value={formData.firstname}
                  onChange={(e) => handleChange("firstname", e.target.value)}
                />
                <TextField
                  variant="textFieldMain"
                  label="Middle Name"
                  value={formData.middlename}
                  onChange={(e) => handleChange("middlename", e.target.value)}
                />
                <TextField
                  variant="textFieldMain"
                  label="Last Name *"
                  value={formData.lastname}
                  onChange={(e) => handleChange("lastname", e.target.value)}
                />
                <TextField
                  variant="textFieldMain"
                  label="Email *"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
                <TextField
                  variant="textFieldMain"
                  label="Contact Number"
                  value={formData.contact}
                  onChange={(e) => handleChange("contact", e.target.value)}
                />
                <TextField
                  variant="textFieldMain"
                  label="Address"
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
                      ✓ This user can be assigned as an approver for specific
                      forms in the Form Approvals tab.
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
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                />
                <div className="flex flex-col space-y-2">
                  <Label>Password</Label>
                  <Button
                    variant="buttonMain"
                    type="button"
                    onClick={handleOpenResetPassword}
                  >
                    Reset Password
                  </Button>
                </div>
              </div>
            </div>

            <Dialog
              open={isResetPasswordOpen}
              onOpenChange={setIsResetPasswordOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Password</DialogTitle>
                  <DialogDescription>
                    The password is pre-filled with the default. You may edit
                    it before submitting. This takes effect immediately, and
                    the user will be required to change it on next login.
                  </DialogDescription>
                </DialogHeader>
                <TextField
                  variant="textFieldMain"
                  label="New Password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  disabled={resetPasswordMutation.isPending}
                />
                <DialogFooter>
                  <Button
                    variant="buttonMainNegative"
                    type="button"
                    disabled={resetPasswordMutation.isPending}
                    onClick={() => setIsResetPasswordOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="buttonMain"
                    type="button"
                    disabled={resetPasswordMutation.isPending}
                    onClick={handleSubmitResetPassword}
                  >
                    {resetPasswordMutation.isPending
                      ? "Submitting..."
                      : "Submit"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="buttonMain"
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm User Update</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to update this user's information?
                      Please review all changes before proceeding.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>
                      Confirm Update
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <div className="bg-white shadow-md p-6 rounded space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-700">
                Assign Forms to Approve
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select which forms{" "}
                <span className="font-medium">
                  {formData.firstname} {formData.lastname}
                </span>{" "}
                can approve and at which level.
              </p>
            </div>

            {!hasApproverRole ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500">
                  This user does not have the approver role assigned.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Please assign the 'Approver', 'All Access', or 'QFD Admin'
                  role in the Personal Information tab first.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <TextField
                    variant="textFieldMain"
                    placeholder="Search forms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <p className="text-sm text-gray-500 whitespace-nowrap">
                    {filteredForms.length} form(s)
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ This user can be assigned as an approver at any level
                    (1st, 2nd, or 3rd).
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    You can assign them to multiple approval levels for the same
                    form.
                  </p>
                </div>

                {isLoadingApprovals ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading forms...</p>
                  </div>
                ) : filteredForms.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">
                      {searchQuery
                        ? "No forms found matching your search"
                        : "No forms available"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredForms.map((form) => {
                      const hasAnyAssignment =
                        form.assignments.first ||
                        form.assignments.second ||
                        form.assignments.third;

                      return (
                        <div
                          key={form.form_id}
                          className={`border rounded-lg p-4 ${
                            hasAnyAssignment
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-800">
                                {form.form_name}
                              </h3>
                              {form.form_description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {form.form_description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-4">
                            <Label className="text-sm font-medium text-gray-700">
                              Assign as:
                            </Label>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`form-${form.form_id}-first`}
                                  checked={form.assignments.first}
                                  onCheckedChange={() =>
                                    handleApprovalChange(form.form_id, "first")
                                  }
                                />
                                <label
                                  htmlFor={`form-${form.form_id}-first`}
                                  className="text-sm cursor-pointer"
                                >
                                  1st Approver
                                </label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`form-${form.form_id}-second`}
                                  checked={form.assignments.second}
                                  onCheckedChange={() =>
                                    handleApprovalChange(form.form_id, "second")
                                  }
                                />
                                <label
                                  htmlFor={`form-${form.form_id}-second`}
                                  className="text-sm cursor-pointer"
                                >
                                  2nd Approver
                                </label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`form-${form.form_id}-third`}
                                  checked={form.assignments.third}
                                  onCheckedChange={() =>
                                    handleApprovalChange(form.form_id, "third")
                                  }
                                />
                                <label
                                  htmlFor={`form-${form.form_id}-third`}
                                  className="text-sm cursor-pointer"
                                >
                                  3rd Approver
                                </label>
                              </div>

                              {hasAnyAssignment && (
                                <button
                                  onClick={() =>
                                    handleApprovalChange(form.form_id, "none")
                                  }
                                  className="text-sm text-red-600 hover:text-red-800 underline"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="buttonMain"
                    onClick={handleSaveApprovals}
                    disabled={saveApprovalsMutation.isPending}
                  >
                    {saveApprovalsMutation.isPending
                      ? "Saving..."
                      : "Save Form Approvals"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
