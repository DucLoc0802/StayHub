import { BadRequestException, ValidationError } from '@nestjs/common';
const labels: Record<string, string> = {
  email: 'email',
  password: 'mật khẩu',
  fullName: 'họ tên',
  role: 'vai trò',
  type: 'loại chỗ nghỉ',
  name: 'tên chỗ nghỉ',
  description: 'mô tả',
  district: 'khu vực',
  address: 'địa chỉ',
  pricePerNight: 'giá mỗi đêm',
  depositPercent: 'tỷ lệ cọc',
  maxGuests: 'sức chứa',
  bedrooms: 'số phòng ngủ',
  beds: 'số giường',
  bathrooms: 'số phòng tắm',
  images: 'ảnh chỗ nghỉ',
  amenityIds: 'tiện ích',
  propertyId: 'chỗ nghỉ',
  guestCount: 'số khách',
  checkIn: 'ngày nhận phòng',
  checkOut: 'ngày trả phòng',
  status: 'trạng thái',
  q: 'từ khóa',
  minPrice: 'giá tối thiểu',
  maxPrice: 'giá tối đa',
  amenities: 'tiện ích',
  sort: 'sắp xếp',
  page: 'trang',
  limit: 'số kết quả mỗi trang',
};
export function validationException(errors: ValidationError[]) {
  return new BadRequestException(
    errors.map((error) => {
      const message = Object.values(error.constraints ?? {}).find((value) =>
        /[À-ỹ]/.test(value),
      );
      return (
        message ??
        `Thông tin ${labels[error.property] ?? 'gửi lên'} không hợp lệ hoặc vượt giới hạn cho phép.`
      );
    }),
  );
}
