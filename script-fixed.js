// Có điểm cố định

// Khởi tạo bản đồ hiển thị tại Cần Thơ
var map = L.map('map').setView([10.045162, 105.746857], 13);

// Thêm lớp bản đồ
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Danh sách các điểm mặc định ở Cần Thơ (Đại học Cần Thơ và Bến Ninh Kiều)
var stores = [
    { name: "Đại học Cần Thơ", coords: [10.029933, 105.770961] },
    { name: "Bến Ninh Kiều", coords: [10.033024, 105.782661] }
];

// Biến lưu trữ các marker và đối tượng điều khiển tuyến đường
var markers = [];  // Lưu trữ các marker hiện có
var routingControl;  // Đối tượng kiểm soát đường đi
var fixedMarker;  // Đối tượng marker cho điểm cố định (điểm đầu)

// Thêm marker cho Đại học Cần Thơ vào bản đồ và giữ cố định trong danh sách
fixedMarker = L.marker(stores[0].coords, { draggable: true }) // Làm cho marker có thể kéo
    .addTo(map)
    .bindPopup(stores[0].name)
    .on('dragend', function(e) {
        // Cập nhật vị trí mới của điểm cố định khi người dùng kéo marker
        updateRoute(fixedMarker.getLatLng(), markers[1]?.getLatLng()); // Cập nhật tuyến đường với điểm mới
    });

markers.push(fixedMarker); // Cố định điểm đầu tiên

// Hiển thị tuyến đường từ Đại học Cần Thơ đến Bến Ninh Kiều ngay từ đầu
routingControl = L.Routing.control({
    waypoints: [
        L.latLng(stores[0].coords), // Đại học Cần Thơ
        L.latLng(stores[1].coords)  // Bến Ninh Kiều
    ],
    routeWhileDragging: true, // Cho phép kéo đường đi
    lineOptions: {
        styles: [{ className: 'leaflet-routing-line' }] // Áp dụng lớp CSS cho đường đi
    }
}).addTo(map);

// Hàm cập nhật tuyến đường
function updateRoute(startLatLng, endLatLng) {
    if (routingControl) {
        map.removeControl(routingControl); // Xóa tuyến đường cũ
    }

    if (startLatLng && endLatLng) {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(startLatLng), L.latLng(endLatLng)],
            routeWhileDragging: true,
            lineOptions: {
                styles: [{ className: 'leaflet-routing-line' }]
            }
        }).addTo(map);
    }
}

// Sự kiện click trên bản đồ để thay đổi điểm thứ hai
map.on('click', function(e) {
    var latlng = e.latlng;

    // Xóa marker cũ thứ hai nếu đã có (chỉ giữ marker đầu tiên cố định)
    if (markers.length >= 2) {
        var oldMarker = markers.pop();  // Xóa marker thứ hai trong danh sách
        map.removeLayer(oldMarker);  // Xóa marker đó khỏi bản đồ
    }

    // Thêm marker mới vào bản đồ
    var newMarker = L.marker(latlng).addTo(map)
        .bindPopup(latlng.toString())
        .openPopup();

    markers.push(newMarker);  // Thêm marker mới làm điểm thứ hai

    // Cập nhật các waypoints và vẽ đường đi giữa điểm cố định và điểm mới
    updateRoute(fixedMarker.getLatLng(), newMarker.getLatLng());
});