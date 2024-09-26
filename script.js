// Khởi tạo bản đồ hiển thị tại Cần Thơ
var map = L.map('map').setView([10.045162, 105.746857], 13);

// Thêm lớp bản đồ
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Danh sách các điểm mặc định ở Cần Thơ (Đại học Cần Thơ và Bến Ninh Kiều)
var defaults = [
    { name: "Đại học Nam Cần Thơ", coords: [10.031785, 105.774657] },
    { name: "Bến Ninh Kiều", coords: [10.033024, 105.782661] }
];

// Biến lưu trữ các điểm marker và đường đi
var markers = [];  // Lưu trữ các marker hiện có
var routingControl;  // Đối tượng kiểm soát đường đi

// Mảng lưu trữ lịch sử hành trình
let journeyHistory = []; // Lịch sử tọa độ đã vẽ

// Thêm các điểm mặc định vào bản đồ
defaults.forEach(function(store) {
    var marker = L.marker(store.coords).addTo(map)
        .bindPopup(store.name);
    markers.push(marker);
});

// Hiển thị tuyến đường từ Đại học Cần Thơ đến Bến Ninh Kiều ngay từ đầu
routingControl = L.Routing.control({
    waypoints: [
        L.latLng(defaults[0].coords), // Đại học Cần Thơ
        L.latLng(defaults[1].coords)  // Bến Ninh Kiều
    ],
    routeWhileDragging: true,
    lineOptions: {
        styles: [{ className: 'leaflet-routing-line' }]
    }
}).addTo(map);

// Lắng nghe sự kiện khi tuyến đường mặc định đã được tính toán
routingControl.on('routesfound', function(e) {
    var routes = e.routes;
    var route = routes[0]; // Chọn tuyến đường đầu tiên (chính)

    // Thêm các đoạn đường từ route đã tính toán vào journeyHistory
    route.coordinates.forEach(function(coord) {
        // Kiểm tra xem tọa độ đã có trong journeyHistory chưa
        if (!journeyHistory.some(h => h[0] === coord.lat && h[1] === coord.lng)) {
            journeyHistory.push([coord.lat, coord.lng]);
        }
    });

    drawHistoryPolyline(); // Vẽ lại lịch sử hành trình
});

// Hàm reverse geocoding sử dụng Nominatim để lấy tên địa điểm từ tọa độ
function reverseGeocode(latlng, callback) {
    var url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.address) {
                let name = data.display_name || `Không tìm thấy địa điểm<br>(${latlng.lat}, ${latlng.lng})`;
                callback(name);
            } else {
                callback(`Không tìm thấy địa điểm<br>(${latlng.lat}, ${latlng.lng})`);
            }
        })
        .catch(err => {
            console.error(err);
            callback(`Lỗi khi lấy dữ liệu<br>(${latlng.lat}, ${latlng.lng})`);
        });
}

// Sự kiện click trên bản đồ
map.on('click', function(e) {
    var latlng = e.latlng;

    reverseGeocode(latlng, function(locationName) {
        var newMarker = L.marker(latlng).addTo(map)
            .bindPopup(locationName).openPopup();

        markers.push(newMarker);

        // Chỉ vẽ lại lịch sử khi có điểm mới được thêm
        if (markers.length >= 2) {
            // Lấy waypoint cho tuyến đường mới
            var waypoints = [
                markers[markers.length - 2].getLatLng(), // Từ điểm gần cuối
                newMarker.getLatLng() // Đến điểm mới
            ];

            // Xóa routingControl cũ nếu có
            if (routingControl) {
                map.removeControl(routingControl);
            }

            // Tạo routingControl với hai waypoint gần nhất
            routingControl = L.Routing.control({
                waypoints: waypoints,
                routeWhileDragging: true,
                lineOptions: {
                    styles: [{ className: 'leaflet-routing-line' }]
                }
            }).addTo(map);

            // Lắng nghe sự kiện khi tuyến đường đã được tính toán
            routingControl.on('routesfound', function(e) {
                var routes = e.routes;
                var route = routes[0]; // Chọn tuyến đường đầu tiên (chính)

                // Thêm các đoạn đường từ route đã tính toán vào journeyHistory
                route.coordinates.forEach(function(coord) {
                    // Kiểm tra xem tọa độ đã có trong journeyHistory chưa
                    if (!journeyHistory.some(h => h[0] === coord.lat && h[1] === coord.lng)) {
                        journeyHistory.push([coord.lat, coord.lng]);
                    }
                });

                // Vẽ lại đường lịch sử từ đầu đến điểm gần nhất (không vẽ tuyến đường mới nhất)
                drawHistoryPolyline(); // Chỉ vẽ lịch sử, không bao gồm tuyến đường mới nhất

                // Phóng to vào cả waypoint và đường đi
                var allWaypoints = journeyHistory.slice(-0.9).concat(waypoints); // Kết hợp đường đi vào
                map.fitBounds(L.latLngBounds(allWaypoints)); // Điều chỉnh bản đồ để bao gồm các waypoint và đường đi
            });
        } else {
            journeyHistory.push([latlng.lat, latlng.lng]); // Chỉ thêm vào history khi là điểm đầu tiên
        }

        updateJourneyNames();
    });
});

// Hàm để vẽ lại lịch sử hành trình
function drawHistoryPolyline() {
    if (map.polyline) {
        map.removeLayer(map.polyline); // Xóa đường lịch sử cũ nếu có
    }

    if (journeyHistory.length > 1) {
        // Chỉ vẽ lịch sử đến điểm gần nhất, không bao gồm điểm cuối
        var historyToDraw = journeyHistory.slice(0, -1); // Bỏ qua đoạn cuối cùng
        map.polyline = L.polyline(historyToDraw, { color: 'blue', dashArray: '5, 5' }).addTo(map);
    }
}

// Hàm để cập nhật danh sách tên các vị trí
function updateJourneyNames() {
    var journeyNamesElement = document.getElementById("journeyNames");
    journeyNamesElement.innerHTML = ''; // Xóa nội dung cũ

    if (markers.length === 0) {
        journeyNamesElement.innerHTML = "Chưa có hành trình.";
    } else {
        // Tạo bảng HTML
        const table = document.createElement('table');
        table.style.width = '100%';
        table.border = '1';

        // Tạo hàng tiêu đề
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Điểm bắt đầu</th>
            <th>Tên đường</th>
            <th>Điểm kết thúc</th>`;
        table.appendChild(headerRow);

        markers.forEach((marker, index) => {
            const name = marker.getPopup().getContent(); // Lấy tên từ popup
            const row = document.createElement('tr'); // Tạo hàng mới cho mỗi vị trí

            // Tạo cột "Điểm bắt đầu"
            const startCell = document.createElement('td');
            startCell.style.textAlign = 'center';
            startCell.textContent = `${index + 1}`;

            // Tạo cột "Tên đường"
            const nameCell = document.createElement('td');
            nameCell.textContent = name;

            // Tạo cột "Điểm kết thúc" chỉ nếu có điểm tiếp theo
            let endCell = document.createElement('td');
            if (markers[index + 1]) {
                endCell.style.textAlign = 'center';
                endCell.textContent = `${index + 2}`; // Gán giá trị điểm tiếp theo

                // Thêm sự kiện hover cho cột "Điểm kết thúc"
                endCell.addEventListener('mouseover', () => {
                    const nextMarker = markers[index + 1];
                    map.panTo(nextMarker.getLatLng()); // Căn giữa điểm tiếp theo
                    nextMarker.openPopup(); // Mở popup cho điểm tiếp theo
                });

                endCell.addEventListener('mouseout', () => {
                    markers[index + 1].closePopup(); // Đóng popup khi không hover
                    panToLastMarker(); // Căn bản đồ về điểm mới nhất
                });
            } else {
                // Nếu không có điểm đến tiếp theo, không hiển thị cột "Điểm kết thúc"
                endCell.style.textAlign = 'center';
                endCell.textContent = '---';
            }

            // Thêm sự kiện hover cho cột "Điểm bắt đầu"
            startCell.addEventListener('mouseover', () => {
                map.panTo(marker.getLatLng()); // Căn giữa điểm vào tầm nhìn của bản đồ
                marker.openPopup(); // Mở popup khi hover
            });

            startCell.addEventListener('mouseout', () => {
                marker.closePopup(); // Đóng popup khi không hover
                panToLastMarker(); // Căn bản đồ về điểm mới nhất
            });

            // Thêm các ô vào hàng
            row.appendChild(startCell);
            row.appendChild(nameCell);
            row.appendChild(endCell);

            table.appendChild(row); // Thêm hàng vào bảng
        });

        journeyNamesElement.appendChild(table); // Thêm bảng vào phần tử chứa
    }
}

// Hàm để căn bản đồ về điểm mới nhất
function panToLastMarker() {
    if (markers.length > 0) {
        const lastMarker = markers[markers.length - 1];
        map.panTo(lastMarker.getLatLng());
    }
}

// Hàm để xem lịch sử hành trình
function showJourneyHistory() {
    console.log("Lịch sử hành trình:", journeyHistory);
}

// Gọi hàm để xem lịch sử hành trình
setTimeout(showJourneyHistory, 10000);
