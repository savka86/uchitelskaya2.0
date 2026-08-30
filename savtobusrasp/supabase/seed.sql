begin;

insert into public.routes (id, route_number, name, locality, source_date, source_note)
values ('namtsy-2', '2', 'Куонда-Кириэс — РЭС', 'село Намцы', '2023-02-06', 'Расписание перенесено с предоставленной фотографии объявления');

insert into public.stops (id, name) values
  ('kyuonda-kiries', 'Куонда-Кириэс'),
  ('mira', 'Мира'),
  ('manchary', 'Манчары'),
  ('zamyatina-1', 'Замятина 1'),
  ('zamyatina-2', 'Замятина 2'),
  ('zamyatina-3', 'Замятина 3'),
  ('stacionar', 'Стационар'),
  ('nachalnaya-shkola', 'Начальная школа'),
  ('pochta', 'Почта'),
  ('magazin-valeriya', 'Магазин Валерия'),
  ('tuelbe', 'Туелбэ'),
  ('sportivnaya-ploshchadka', 'Спортивная площадка'),
  ('stroitelnaya', 'Строительная'),
  ('res', 'РЭС');

insert into public.route_stops (route_id, direction, stop_id, stop_sequence) values
  ('namtsy-2', 'forward', 'kyuonda-kiries', 1),
  ('namtsy-2', 'forward', 'mira', 2),
  ('namtsy-2', 'forward', 'manchary', 3),
  ('namtsy-2', 'forward', 'zamyatina-1', 4),
  ('namtsy-2', 'forward', 'zamyatina-2', 5),
  ('namtsy-2', 'forward', 'zamyatina-3', 6),
  ('namtsy-2', 'forward', 'stacionar', 7),
  ('namtsy-2', 'forward', 'nachalnaya-shkola', 8),
  ('namtsy-2', 'forward', 'pochta', 9),
  ('namtsy-2', 'forward', 'magazin-valeriya', 10),
  ('namtsy-2', 'forward', 'tuelbe', 11),
  ('namtsy-2', 'forward', 'sportivnaya-ploshchadka', 12),
  ('namtsy-2', 'forward', 'stroitelnaya', 13),
  ('namtsy-2', 'forward', 'res', 14),
  ('namtsy-2', 'return', 'res', 1),
  ('namtsy-2', 'return', 'stroitelnaya', 2),
  ('namtsy-2', 'return', 'sportivnaya-ploshchadka', 3),
  ('namtsy-2', 'return', 'tuelbe', 4),
  ('namtsy-2', 'return', 'magazin-valeriya', 5),
  ('namtsy-2', 'return', 'pochta', 6),
  ('namtsy-2', 'return', 'nachalnaya-shkola', 7),
  ('namtsy-2', 'return', 'stacionar', 8),
  ('namtsy-2', 'return', 'zamyatina-3', 9),
  ('namtsy-2', 'return', 'zamyatina-2', 10),
  ('namtsy-2', 'return', 'zamyatina-1', 11),
  ('namtsy-2', 'return', 'manchary', 12),
  ('namtsy-2', 'return', 'mira', 13),
  ('namtsy-2', 'return', 'kyuonda-kiries', 14);

insert into public.trips (id, route_id, direction, label, first_timed_stop) values
  ('n2-f-0732', 'namtsy-2', 'forward', 'Рейс 07:32 от остановки Мира', '07:32'),
  ('n2-f-0832', 'namtsy-2', 'forward', 'Рейс 08:32 от остановки Мира', '08:32'),
  ('n2-f-1333', 'namtsy-2', 'forward', 'Рейс 13:33 от остановки Мира', '13:33'),
  ('n2-f-1633', 'namtsy-2', 'forward', 'Рейс 16:33 от остановки Мира', '16:33'),
  ('n2-f-1733', 'namtsy-2', 'forward', 'Рейс 17:33 от остановки Мира', '17:33'),
  ('n2-f-1833', 'namtsy-2', 'forward', 'Рейс 18:33 от остановки Мира', '18:33'),
  ('n2-r-0802', 'namtsy-2', 'return', 'Рейс 08:02 от остановки Строительная', '08:02'),
  ('n2-r-0902', 'namtsy-2', 'return', 'Рейс 09:02 от остановки Строительная', '09:02'),
  ('n2-r-1302', 'namtsy-2', 'return', 'Рейс 13:02 от остановки Строительная', '13:02'),
  ('n2-r-1702', 'namtsy-2', 'return', 'Рейс 17:02 от остановки Строительная', '17:02'),
  ('n2-r-1802', 'namtsy-2', 'return', 'Рейс 18:02 от остановки Строительная', '18:02'),
  ('n2-r-1902', 'namtsy-2', 'return', 'Рейс 19:02 от остановки Строительная', '19:02');

with forward_runs (trip_id, start_time, end_status) as (values
  ('n2-f-0732', time '07:32', 'стоянка'),
  ('n2-f-0832', time '08:32', 'конечная'),
  ('n2-f-1333', time '13:33', 'конечная'),
  ('n2-f-1633', time '16:33', 'стоянка'),
  ('n2-f-1733', time '17:33', 'стоянка'),
  ('n2-f-1833', time '18:33', 'стоянка')
), forward_offsets (stop_id, stop_sequence, minute_offset) as (values
  ('mira', 2, 0), ('manchary', 3, 2), ('zamyatina-1', 4, 5),
  ('zamyatina-2', 5, 7), ('zamyatina-3', 6, 8), ('stacionar', 7, 10),
  ('nachalnaya-shkola', 8, 13), ('pochta', 9, 15), ('magazin-valeriya', 10, 17),
  ('tuelbe', 11, 20), ('sportivnaya-ploshchadka', 12, 22), ('stroitelnaya', 13, 24)
)
insert into public.stop_times (trip_id, stop_id, stop_sequence, scheduled_time)
select trip_id, stop_id, stop_sequence, start_time + minute_offset * interval '1 minute'
from forward_runs cross join forward_offsets;

insert into public.stop_times (trip_id, stop_id, stop_sequence, terminal_status)
select id, 'kyuonda-kiries', 1, 'стоянка' from public.trips where direction = 'forward';

with statuses (trip_id, terminal_status) as (values
  ('n2-f-0732', 'стоянка'), ('n2-f-0832', 'конечная'), ('n2-f-1333', 'конечная'),
  ('n2-f-1633', 'стоянка'), ('n2-f-1733', 'стоянка'), ('n2-f-1833', 'стоянка')
)
insert into public.stop_times (trip_id, stop_id, stop_sequence, terminal_status)
select trip_id, 'res', 14, terminal_status from statuses;

with return_runs (trip_id, start_time) as (values
  ('n2-r-0802', time '08:02'), ('n2-r-0902', time '09:02'), ('n2-r-1302', time '13:02'),
  ('n2-r-1702', time '17:02'), ('n2-r-1802', time '18:02'), ('n2-r-1902', time '19:02')
), return_offsets (stop_id, stop_sequence, minute_offset) as (values
  ('stroitelnaya', 2, 0), ('sportivnaya-ploshchadka', 3, 2), ('tuelbe', 4, 4),
  ('magazin-valeriya', 5, 6), ('pochta', 6, 8), ('nachalnaya-shkola', 7, 10),
  ('stacionar', 8, 13), ('zamyatina-3', 9, 16), ('zamyatina-2', 10, 18),
  ('zamyatina-1', 11, 20), ('manchary', 12, 24), ('mira', 13, 26)
)
insert into public.stop_times (trip_id, stop_id, stop_sequence, scheduled_time)
select trip_id, stop_id, stop_sequence, start_time + minute_offset * interval '1 minute'
from return_runs cross join return_offsets;

with statuses (trip_id, terminal_status) as (values
  ('n2-r-0802', 'стоянка'), ('n2-r-0902', 'конечная'), ('n2-r-1302', 'стоянка'),
  ('n2-r-1702', 'стоянка'), ('n2-r-1802', 'стоянка'), ('n2-r-1902', 'стоянка')
)
insert into public.stop_times (trip_id, stop_id, stop_sequence, terminal_status)
select trip_id, 'res', 1, terminal_status from statuses;

insert into public.stop_times (trip_id, stop_id, stop_sequence, terminal_status)
select id, 'kyuonda-kiries', 14, 'конечная' from public.trips where direction = 'return';

commit;
