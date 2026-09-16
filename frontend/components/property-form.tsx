"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { propertyService, PropertyInput } from "@/lib/services";
import { Property } from "@/lib/types";
import { Button, Field, Input, Select } from "./ui";

const schema = z.object({
  type: z.enum(["HOMESTAY", "HOTEL"]),
  name: z.string().min(3, "Tên phải có ít nhất 3 ký tự."),
  description: z.string().min(20, "Mô tả phải có ít nhất 20 ký tự."),
  district: z.string().min(1, "Vui lòng nhập quận."),
  address: z.string().min(5, "Địa chỉ quá ngắn."),
  pricePerNight: z.number().int().positive("Giá phải lớn hơn 0."),
  depositPercent: z.number().int().min(1).max(100),
  maxGuests: z.number().int().min(1),
  bedrooms: z.number().int().min(0),
  beds: z.number().int().min(1),
  bathrooms: z.number().int().min(1),
  images: z
    .array(z.object({ value: z.url("URL hình ảnh không hợp lệ.") }))
    .min(1),
  amenityCodes: z.array(z.string()).min(1, "Chọn ít nhất một tiện ích."),
});
type Form = z.infer<typeof schema>;
export function PropertyForm({
  property,
  onSubmit,
  pending,
}: {
  property?: Property;
  onSubmit: (value: PropertyInput) => void;
  pending: boolean;
}) {
  const amenities = useQuery({
    queryKey: ["amenities"],
    queryFn: propertyService.amenities,
  });
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: property
      ? {
          type: property.type,
          name: property.name,
          description: property.description,
          district: property.district,
          address: property.address,
          pricePerNight: property.pricePerNight,
          depositPercent: property.depositPercent,
          maxGuests: property.maxGuests,
          bedrooms: property.bedrooms,
          beds: property.beds,
          bathrooms: property.bathrooms,
          images: property.images.map((x) => ({ value: x.url })),
          amenityCodes: property.propertyAmenities.map((x) => x.amenity.code),
        }
      : {
          type: "HOMESTAY",
          name: "",
          description: "",
          district: "",
          address: "",
          pricePerNight: 800000,
          depositPercent: 30,
          maxGuests: 2,
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          images: [{ value: "" }],
          amenityCodes: [],
        },
  });
  const images = useFieldArray({ control: form.control, name: "images" });
  return (
    <form
      onSubmit={form.handleSubmit((v) =>
        onSubmit({ ...v, imageUrls: v.images.map((x) => x.value) }),
      )}
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại chỗ nghỉ">
          <Select {...form.register("type")}>
            <option value="HOMESTAY">Homestay</option>
            <option value="HOTEL">Khách sạn</option>
          </Select>
        </Field>
        <Field label="Tên chỗ nghỉ" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} />
        </Field>
      </div>
      <Field label="Mô tả" error={form.formState.errors.description?.message}>
        <textarea
          className="min-h-28 rounded-xl border border-border bg-white p-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          {...form.register("description")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Quận / khu vực"
          error={form.formState.errors.district?.message}
        >
          <Input placeholder="Quận 1" {...form.register("district")} />
        </Field>
        <Field
          label="Địa chỉ đầy đủ"
          error={form.formState.errors.address?.message}
        >
          <Input {...form.register("address")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Giá mỗi đêm (₫)"
          error={form.formState.errors.pricePerNight?.message}
        >
          <Input
            type="number"
            {...form.register("pricePerNight", { valueAsNumber: true })}
          />
        </Field>
        <Field
          label="Tiền cọc (%)"
          error={form.formState.errors.depositPercent?.message}
        >
          <Input
            type="number"
            {...form.register("depositPercent", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Số khách tối đa">
          <Input
            type="number"
            {...form.register("maxGuests", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Phòng ngủ">
          <Input
            type="number"
            {...form.register("bedrooms", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Giường">
          <Input
            type="number"
            {...form.register("beds", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Phòng tắm">
          <Input
            type="number"
            {...form.register("bathrooms", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-3 font-semibold">Tiện ích</legend>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {amenities.data?.map((a) => (
            <label
              key={a.id}
              className="flex gap-2 rounded-xl bg-surface p-3 text-sm"
            >
              <input
                type="checkbox"
                value={a.code}
                {...form.register("amenityCodes")}
              />
              {a.nameVi}
            </label>
          ))}
        </div>
        {form.formState.errors.amenityCodes && (
          <p className="mt-1 text-xs text-red-600">
            {form.formState.errors.amenityCodes.message}
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend className="mb-3 font-semibold">URL hình ảnh</legend>
        <div className="grid gap-3">
          {images.fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input
                placeholder="https://..."
                {...form.register(`images.${index}.value`)}
              />
              {images.fields.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => images.remove(index)}
                >
                  Xóa
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => images.append({ value: "" })}
          >
            Thêm hình ảnh
          </Button>
        </div>
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu chỗ nghỉ"}
      </Button>
    </form>
  );
}
