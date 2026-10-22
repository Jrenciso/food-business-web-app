export type Role = 'owner' | 'kitchen' | 'chef' | 'rider';
export type OrderType = 'pickup' | 'delivery';
export type Status = 'New' | 'Preparing' | 'Ready' | 'Picked up' | 'Out for delivery' | 'Completed' | 'Cancelled';
export type PayMethod = string;
export interface PaymentMethodOption { id:string; label:string; active:boolean; order:number }
export type PayBasis = 'daily' | 'monthly';
export interface Category { id:string; name:string; color:string; order:number }
export interface Item { id:string; name:string; description:string; categoryId:string; price:number; image:string; available:boolean; flavorCount?:number; ownerVerification?:boolean; order?:number; favorite?:boolean }
export interface Line { itemId:string; name:string; unitPrice:number; quantity:number; note:string; flavors?:string[] }
export interface Payment { id:string; amount:number; method:PayMethod; methodLabel?:string; reference:string; at:string; kind:'payment'|'refund';receivedById?:string;receivedByName?:string;receivedByRole?:Role }
export interface Order { id:string; number:string; createdAt:string; type:OrderType; customer:string; contact:string; address:string; landmark:string; notes:string; lines:Line[]; subtotal:number; deliveryFee:number; deliveryAreaId?:string; deliveryAreaLabel?:string; deliveryAreaFee?:number; deliveryFeeOverrideReason?:string; discount:number; total:number; status:Status; statusHistory:{status:Status;at:string}[]; payments:Payment[]; paidAmount?:number; riderId:string; sample:boolean }
export interface DeliveryArea { id:string; label:string; fee:number; aliases:string; notes:string; active:boolean; order:number }
export interface WorkShift { id:string; name:string; start:string; end:string; active:boolean; order:number }
export interface ActivityEvent { id:string; at:string; actorId:string; actorName:string; actorRole:Role; action:string; target:string; summary:string; workspace:'sample'|'live' }
export interface RateVersion { id:string; amount:number; basis:PayBasis; effectiveDate:string; recordedAt:string }
export interface TeamMember { id:string; name:string; contact:string; accessEmail?:string; role:Role; title:string; active:boolean; activeFrom:string; activeTo:string; notes:string; rates:RateVersion[] }
export interface Attendance { id:string; employeeId:string; date:string; worked:boolean; start:string; end:string; notes:string; updatedAt:string; rateSnapshot:RateVersion|null; revisions:{at:string;summary:string}[]; testData?:boolean; shiftId?:string; shiftName?:string }
export interface PayrollAdjustment { id:string; employeeId:string; date:string; amount:number; reason:string; createdAt:string; category?:string; revisions?:{at:string;summary:string}[]; batchId?:string; voidedAt?:string }
export interface PayrollRun { id:string; employeeId:string; employeeName:string; role:string; from:string; to:string; generatedAt:string; lines:{date:string;basis:PayBasis;rate:number;accrual:number;start?:string;end?:string}[]; adjustments:{date:string;amount:number;reason:string;category?:string}[]; gross:number; state?:'finalized' }
export interface PayrollLine { attendanceId:string; date:string; start:string; end:string; basis:PayBasis; rate:number; accrual:number; shiftName?:string }
export interface PayrollBatchAdjustment { id:string; amount:number; reason:string; category:string; date:string }
export interface PayrollPaymentRecord { at:string; date:string; method:string; methodLabel?:string; reference:string; remark:string; amount:number }
export interface PayrollBatchRow { employeeId:string; employeeName:string; role:string; lines:PayrollLine[]; adjustments:PayrollBatchAdjustment[]; base:number; additions:number; deductions:number; net:number; payment?:PayrollPaymentRecord|null; paymentHistory?:PayrollPaymentRecord[] }
export interface PayrollBatch { id:string; number:string; from:string; to:string; createdAt:string; status:'generated'|'void'; rows:PayrollBatchRow[]; origin?:'legacy'; voidedAt?:string }
export interface PayrollDraft { from:string; to:string; preset:'day'|'week'|'month'|'custom'|'schedule'; employeeIds:string[]; adjustments:Record<string,PayrollBatchAdjustment[]> }
export interface Settings { businessName:string; tagline:string; logo:string; phone:string; address:string; currency:string; timezone:string; footer:string; defaultDeliveryFee:number; accent:string; theme:'light'|'dark'; activeUserId:string; dataMode:'sample'|'live'; tileSizes?:Record<string,'compact'|'comfortable'|'large'>; payrollSchedule?:'weekly'|'twice-monthly'|'monthly'; payrollCutoff?:number; paymentMethods?:PaymentMethodOption[] }
export interface Database { categories:Category[]; items:Item[]; orders:Order[]; team:TeamMember[]; attendance:Attendance[]; adjustments:PayrollAdjustment[]; payrollRuns:PayrollRun[]; payrollBatches?:PayrollBatch[]; payrollDraft?:PayrollDraft|null; deliveryAreas:DeliveryArea[]; workShifts?:WorkShift[]; activity:ActivityEvent[]; settings:Settings; nextTicket:number; legacyDemoArchive?:unknown; sampleOrderArchive?:Order[]; sampleLaborArchive?:{at:string;attendance:Attendance[];adjustments:PayrollAdjustment[];payrollRuns:PayrollRun[];payrollBatches?:PayrollBatch[]}[]; menuArchives?:{at:string;categories:Category[];items:Item[]}[] }
